import { CRAWLER_ARRIVAL, type Situation, situationHash } from "@web4kit/context";
import {
  type Answer,
  type AnswerOrUnanswered,
  type AnswerSet,
  type Decider,
  RULES_ENGINE_ID,
  withFallback,
} from "@web4kit/decider";
import {
  DEVICES,
  type Device,
  PLAN_FORMAT,
  type Plan,
  REGIONS,
  type Region,
  stableHash,
  type Why,
} from "@web4kit/ir";
import type { ComponentManifest, DataSourceManifest, ManifestSet } from "@web4kit/manifest";
import { compatibleComponents, SALIENCE_LEVELS } from "@web4kit/manifest";
import { type Candidate, solve } from "@web4kit/solver";
import { type PlanCache, planCacheKey } from "./cache";
import { type CalibrationProfile, calibrationKey } from "./calibration";
import {
  buildQuestions,
  type Intent,
  KINDS,
  type QuestionKind,
  type QuestionPlan,
  qid,
} from "./questions";
import { createManifestRuleDecider, matches } from "./rules";

export interface PlannerConfig {
  manifests: ManifestSet;
  /** Active engine. Omit to plan with rules only. */
  decider?: Decider;
  calibration?: CalibrationProfile;
  cache?: PlanCache;
  /** Language of the decider input when no intent is given (situation labels are English). */
  inputLanguage?: string;
  /** Called after every plan (cache hits included). Errors thrown here are ignored. */
  onPlan?: (event: PlanEvent) => void;
  /**
   * `development`: decisions without a current calibration threshold (no profile, stale source,
   * missing entry) use the engine's answer, recorded as ungated. Ignored when NODE_ENV is
   * production. Default `production`.
   */
  gating?: "production" | "development";
}

export interface PlanEvent extends PlanResult {
  situationHash: string;
  engineId: string;
}

/**
 * none: no profile given (engine answers gate as uncalibrated, i.e. rules decide);
 * active: profile is current for every source;
 * partial: current for some sources; the stale ones gate as uncalibrated;
 * stale: profile was measured against another decider surface for every source and is ignored.
 */
export type CalibrationStatus =
  | { status: "none" }
  | { status: "active"; version: string }
  | { status: "partial"; version: string; staleSources: string[] }
  | { status: "stale"; version: string; reason: string };

export interface PlannerStats {
  engineId: string;
  calibration: CalibrationStatus;
  since: string;
  pages: number;
  cacheHits: number;
  deciderRequests: number;
  inputTokens: number;
  /** Estimated from the engine's declared price per million input tokens. */
  costUsd: number;
  planningMsTotal: number;
  distinctSituations: number;
}

export interface PlanRequest {
  situation: Situation;
  intent?: Intent;
}

export interface PlanResult {
  plan: Plan;
  cacheHit: boolean;
  planningMs: number;
  usage: { requests: number; inputTokens: number };
}

export interface Planner {
  readonly engineId: string;
  readonly calibrationStatus: CalibrationStatus;
  /** Whether development gating is in effect (never in production). */
  readonly developmentGating: boolean;
  plan(request: PlanRequest): Promise<PlanResult>;
  /** Per-process counters since the planner was created. */
  stats(): PlannerStats;
}

const MAX_TRACKED_SITUATIONS = 10_000;

/**
 * Match a profile against the manifests it is used with. Profiles with per-source versions are
 * matched per source (dx-dev-loop D2); v1 profiles at site level (web4-v1-authoring D6).
 */
export function checkCalibration(
  manifests: ManifestSet,
  profile: CalibrationProfile | undefined,
): CalibrationStatus {
  if (!profile) return { status: "none" };
  const stale = staleSources(manifests, profile);
  if (stale.length === 0) return { status: "active", version: profile.version };
  if (stale.length < manifests.sources.length)
    return { status: "partial", version: profile.version, staleSources: stale };
  return {
    status: "stale",
    version: profile.version,
    reason: profile.sourceVersions
      ? "every source changed since calibration"
      : `measured against ${profile.manifestVersion}, manifests are ${manifests.deciderVersion}`,
  };
}

/** Sources the profile is not current for (a source the profile does not mention is stale). */
function staleSources(manifests: ManifestSet, profile: CalibrationProfile): string[] {
  const recorded = profile.sourceVersions;
  if (!recorded)
    return profile.manifestVersion === manifests.deciderVersion
      ? []
      : manifests.sources.map((s) => s.id);
  return manifests.sources
    .filter((s) => recorded[s.id] !== manifests.sourceDeciderVersions[s.id])
    .map((s) => s.id);
}

const isProductionProcess = () =>
  typeof process !== "undefined" && process.env?.NODE_ENV === "production";

const NO_CALIBRATION = "cal-none";

export function createPlanner(config: PlannerConfig): Planner {
  const { manifests } = config;
  const rules = createManifestRuleDecider(manifests);
  const engine = config.decider ?? rules;
  const isRules = engine.id === RULES_ENGINE_ID;
  const decider = isRules ? rules : withFallback(engine, rules);
  const calibrationStatus: CalibrationStatus = isRules
    ? { status: "none" }
    : checkCalibration(manifests, config.calibration);
  // A stale profile would gate with thresholds measured on other questions: drop it. A partial
  // one is used only for its current sources.
  const usable = calibrationStatus.status === "active" || calibrationStatus.status === "partial";
  const calibration = usable ? config.calibration : undefined;
  const stale = new Set(
    calibrationStatus.status === "partial" ? calibrationStatus.staleSources : [],
  );
  // Ungated answers are impossible outside development, whatever the configuration says.
  const developmentGating = !isRules && config.gating === "development" && !isProductionProcess();
  const calibrationVersion = isRules
    ? "rules"
    : `${calibration?.version ?? NO_CALIBRATION}${developmentGating ? "+dev" : ""}`;

  const counters = {
    since: new Date().toISOString(),
    pages: 0,
    cacheHits: 0,
    deciderRequests: 0,
    inputTokens: 0,
    planningMsTotal: 0,
    situations: new Set<string>(),
  };
  const costPerMTok = isRules ? 0 : (engine.capabilities.costPerMTok ?? 0);
  const record = (result: PlanResult, situationHash: string) => {
    counters.pages++;
    if (result.cacheHit) counters.cacheHits++;
    counters.deciderRequests += result.usage.requests;
    counters.inputTokens += result.usage.inputTokens;
    counters.planningMsTotal += result.planningMs;
    if (counters.situations.size < MAX_TRACKED_SITUATIONS) counters.situations.add(situationHash);
    try {
      config.onPlan?.({ ...result, situationHash, engineId: engine.id });
    } catch {
      // Instrumentation must never break a page.
    }
    return result;
  };

  return {
    engineId: engine.id,
    calibrationStatus,
    developmentGating,
    stats: () => ({
      engineId: engine.id,
      calibration: calibrationStatus,
      since: counters.since,
      pages: counters.pages,
      cacheHits: counters.cacheHits,
      deciderRequests: counters.deciderRequests,
      inputTokens: counters.inputTokens,
      costUsd: (counters.inputTokens / 1e6) * costPerMTok,
      planningMsTotal: counters.planningMsTotal,
      distinctSituations: counters.situations.size,
    }),
    async plan(request) {
      const started = performance.now();
      // Crawlers get one neutral page per device class: nothing else of the situation is used.
      const crawler = request.situation.arrival === CRAWLER_ARRIVAL;
      const situation = crawler ? crawlerSituation(request.situation) : request.situation;
      const intent = crawler ? undefined : request.intent;
      const hash = situationHash(situation);
      const key = planCacheKey({
        site: manifests.site,
        situationHash: hash,
        manifestVersion: manifests.version,
        engineId: engine.id,
        calibrationVersion,
        ...(intent ? { intentHash: sha(intent.text) } : {}),
      });
      const cached = config.cache?.get(key);
      if (cached) {
        return record(
          {
            plan: cached,
            cacheHit: true,
            planningMs: performance.now() - started,
            usage: { requests: 0, inputTokens: 0 },
          },
          hash,
        );
      }

      if (crawler) {
        const plan = assembleCrawler({
          manifests,
          situation,
          situationHash: hash,
          engineId: engine.id,
          calibrationVersion,
        });
        config.cache?.set(key, plan);
        return record(
          {
            plan,
            cacheHit: false,
            planningMs: performance.now() - started,
            usage: { requests: 0, inputTokens: 0 },
          },
          hash,
        );
      }

      const qp = buildQuestions(manifests, situation, intent ? { intent } : {});
      // One logical round: every stage question for every candidate at once.
      const answers = await decider.decide(qp.state, qp.questions);
      const ruleAnswers = isRules ? answers : await rules.decide(qp.state, qp.questions);
      const language = intent?.language ?? config.inputLanguage ?? "english";

      const gate = createGate({
        isRules,
        calibration,
        stale,
        development: developmentGating,
        sourceOf: (id) => qp.index[id]?.sourceId,
        language,
        answers,
        ruleAnswers,
      });

      const plan = assemble({
        manifests,
        situation,
        situationHash: hash,
        engineId: engine.id,
        calibrationVersion,
        qp,
        gate,
      });
      config.cache?.set(key, plan);
      return record(
        {
          plan,
          cacheHit: false,
          planningMs: performance.now() - started,
          usage: { requests: answers.usage.requests, inputTokens: answers.usage.inputTokens },
        },
        hash,
      );
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Confidence gating (design D3, spec page-planning)
// ---------------------------------------------------------------------------------------------

interface Gated {
  /** The answer to use, or undefined when the manifest default applies. */
  answer: Answer | undefined;
  why: Omit<Why, "answer">;
}

type Gate = (questionId: string, kind: QuestionKind) => Gated;

function createGate(ctx: {
  isRules: boolean;
  calibration: CalibrationProfile | undefined;
  /** Sources the profile is not current for. */
  stale: Set<string>;
  development: boolean;
  sourceOf: (questionId: string) => string | undefined;
  language: string;
  answers: AnswerSet;
  ruleAnswers: AnswerSet;
}): Gate {
  return (id, kind) => {
    const answer = ctx.answers.answers[id];
    const rule = ctx.ruleAnswers.answers[id];
    const asRule = (note?: string): Gated => ({
      answer: isAnswer(rule) ? rule : undefined,
      why: {
        question: kind,
        decidedBy: "rule",
        engine: RULES_ENGINE_ID,
        ...(note ? { note } : {}),
      },
    });
    if (ctx.isRules) return asRule();
    if (!answer) return asRule("no answer returned");
    if (answer.provenance.fallbackReason)
      return asRule(`engine failed: ${answer.provenance.fallbackReason}`);
    if (answer.type === "unanswered") {
      return {
        answer: undefined,
        why: {
          question: kind,
          decidedBy: "default",
          engine: answer.provenance.engine,
          note: answer.reason,
        },
      };
    }
    const sourceId = ctx.sourceOf(id);
    const staleSource = sourceId !== undefined && ctx.stale.has(sourceId);
    const entry = staleSource
      ? undefined
      : ctx.calibration?.entries[calibrationKey(kind, ctx.language)];
    const measured = {
      probabilities: answer.probabilities,
      confidence: answer.confidence,
      engine: answer.provenance.engine,
    };
    const note = staleSource
      ? `uncalibrated: stale source ${sourceId}`
      : `uncalibrated: ${kind}|${ctx.language}`;
    // Missing calibration (no profile, stale source, no entry): in development, trust the engine
    // and say so. Entries measured as unreliable keep gating to rules, as in production.
    if (!entry && ctx.development) {
      return {
        answer,
        why: { question: kind, decidedBy: "ungated", threshold: null, ...measured, note },
      };
    }
    if (!entry || entry.uncalibrated) {
      const r = asRule(note);
      // Record the engine's measured answer (engine = who was overridden), decided by rule.
      return {
        answer: r.answer,
        why: { ...r.why, ...measured, decidedBy: "rule", threshold: null },
      };
    }
    const threshold = entry.acceptThreshold;
    if (answer.confidence >= threshold) {
      return { answer, why: { question: kind, decidedBy: "engine", threshold, ...measured } };
    }
    return {
      answer: undefined,
      why: {
        question: kind,
        decidedBy: "default",
        threshold,
        ...measured,
        note: "below calibrated threshold",
      },
    };
  };
}

function isAnswer(a: AnswerOrUnanswered | undefined): a is Answer {
  return !!a && a.type !== "unanswered";
}

// ---------------------------------------------------------------------------------------------
// Plan assembly
// ---------------------------------------------------------------------------------------------

function assemble(ctx: {
  manifests: ManifestSet;
  situation: Situation;
  situationHash: string;
  engineId: string;
  calibrationVersion: string;
  qp: QuestionPlan;
  gate: Gate;
}): Plan {
  const { manifests, situation, qp, gate } = ctx;
  const componentsById = new Map(manifests.components.map((c) => [c.id, c]));
  const candidates: Candidate[] = [];
  const excluded: Plan["excluded"] = [];

  manifests.sources.forEach((source, order) => {
    const why: Why[] = [];
    const decide = <T extends string | number | boolean>(
      kind: QuestionKind,
      fallback: T,
      read: (a: Answer) => T,
      id = qid(kind, source.id),
    ) => {
      const g = gate(id, kind);
      const value = g.answer ? read(g.answer) : fallback;
      why.push({ ...g.why, answer: value });
      return value;
    };

    if (matches(source.mustExclude, situation)) {
      const conflict = matches(source.mustInclude, situation);
      excluded.push({
        sourceId: source.id,
        why: [
          {
            question: "invariant.must-exclude",
            answer: false,
            decidedBy: "invariant",
            note: `excluded when ${JSON.stringify(source.mustExclude)}${
              conflict ? "; mustInclude also held, exclusion wins" : ""
            }`,
          },
        ],
      });
      return; // No decider answer is read for an excluded source.
    }

    const relevant = decide(
      KINDS.relevance,
      source.default.include,
      (a) => (a.value as number) >= 0.5,
    );
    const salience = decide(
      KINDS.salience,
      SALIENCE_LEVELS.indexOf(source.default.salience),
      (a) => a.value as number,
    );
    const forced = matches(source.mustInclude, situation);
    const include = (relevant && salience >= 0.5) || forced;
    if (forced && !(relevant && salience >= 0.5)) {
      why.push({
        question: "invariant.must-include",
        answer: true,
        decidedBy: "invariant",
        note:
          source.mustInclude === "always"
            ? "required on every page"
            : `required when ${JSON.stringify(source.mustInclude)}`,
      });
    }
    if (!include) {
      excluded.push({ sourceId: source.id, why });
      return; // Stage B/C answers for rejected sources are discarded.
    }

    const componentId = chooseComponent(source, qp, gate, why, componentsById);
    const component = componentsById.get(componentId)!;
    const region = decide(KINDS.region, source.default.region, (a) => a.value as string) as Region;
    const prominence = decide(
      KINDS.prominence,
      source.default.prominence,
      (a) => a.value as number,
    );
    const fallback = component.fallback ? componentsById.get(component.fallback) : undefined;

    candidates.push({
      sourceId: source.id,
      componentId,
      propsBinding: Object.fromEntries(
        Object.entries(source.fields).map(([role, f]) => [role, f.path]),
      ),
      region: REGIONS.includes(region) ? region : source.default.region,
      prominence:
        forced && situationForcesProminence(source, situation)
          ? Math.max(prominence, 2)
          : prominence,
      salience,
      defaultRank: order,
      footprint: component.footprint,
      mediaHeavy: component.mediaHeavy,
      ...(fallback
        ? { fallback: { componentId: fallback.id, footprint: fallback.footprint } }
        : {}),
      why,
    });
  });

  const device: Device = (DEVICES as readonly string[]).includes(situation.device ?? "")
    ? (situation.device as Device)
    : "mobile";
  const mediaBudget =
    situation.mediaBudget === "low" ? "low" : situation.mediaBudget === "high" ? "high" : "unknown";
  const { layout, dropped } = solve({ candidates, device, seed: ctx.situationHash, mediaBudget });

  return {
    format: PLAN_FORMAT,
    site: manifests.site,
    situationHash: ctx.situationHash,
    engine: ctx.engineId,
    calibrationVersion: ctx.calibrationVersion,
    manifestVersion: manifests.version,
    device,
    layout,
    excluded: [...excluded, ...dropped],
  };
}

// ---------------------------------------------------------------------------------------------
// Crawler plans (spec: page-planning, complete plan for crawlers; design D8)
// ---------------------------------------------------------------------------------------------

/** The only labels a crawler plan depends on. */
function crawlerSituation(situation: Situation): Situation {
  return situation.device
    ? { arrival: CRAWLER_ARRIVAL, device: situation.device }
    : { arrival: CRAWLER_ARRIVAL };
}

/**
 * Every public source with its manifest defaults, in manifest order, with no decider call and
 * nothing dropped for capacity. Personalising conditions (audience, heuristics, mustInclude,
 * mustExclude, default include) are not evaluated: search engines see everything public.
 */
function assembleCrawler(ctx: {
  manifests: ManifestSet;
  situation: Situation;
  situationHash: string;
  engineId: string;
  calibrationVersion: string;
}): Plan {
  const { manifests, situation } = ctx;
  const componentsById = new Map(manifests.components.map((c) => [c.id, c]));
  const candidates: Candidate[] = [];
  const excluded: Plan["excluded"] = [];

  manifests.sources.forEach((source, order) => {
    if (source.access !== "public") {
      excluded.push({
        sourceId: source.id,
        why: [
          {
            question: "invariant.crawler",
            answer: false,
            decidedBy: "invariant",
            note: `crawler: restricted to roles ${source.access.roles.join(", ")}`,
          },
        ],
      });
      return;
    }
    const componentId =
      source.default.component ?? compatibleComponents(source, manifests.components)[0]!.id;
    const component = componentsById.get(componentId)!;
    candidates.push({
      sourceId: source.id,
      componentId,
      propsBinding: Object.fromEntries(
        Object.entries(source.fields).map(([role, f]) => [role, f.path]),
      ),
      region: source.default.region,
      prominence: source.default.prominence,
      // Equal salience: order comes from default prominence, then manifest order.
      salience: 0,
      defaultRank: order,
      footprint: component.footprint,
      mediaHeavy: component.mediaHeavy,
      why: [
        {
          question: "invariant.crawler",
          answer: true,
          decidedBy: "invariant",
          note: "crawler: complete page with manifest defaults",
        },
      ],
    });
  });

  const device: Device = (DEVICES as readonly string[]).includes(situation.device ?? "")
    ? (situation.device as Device)
    : "mobile";
  const { layout, dropped } = solve({
    candidates,
    device,
    seed: CRAWLER_ARRIVAL,
    mediaBudget: "unknown",
    // Overflow keeps demoting; the last region takes any number, so nothing is dropped.
    capacities: { footer: Number.POSITIVE_INFINITY },
  });

  return {
    format: PLAN_FORMAT,
    site: manifests.site,
    situationHash: ctx.situationHash,
    engine: ctx.engineId,
    calibrationVersion: ctx.calibrationVersion,
    manifestVersion: manifests.version,
    device,
    layout,
    excluded: [...excluded, ...dropped],
  };
}

/** A forced source is also made prominent (e.g. "closed" must be visible, not buried). */
function situationForcesProminence(source: DataSourceManifest, situation: Situation) {
  return matches(source.mustInclude, situation);
}

function chooseComponent(
  source: DataSourceManifest,
  qp: QuestionPlan,
  gate: Gate,
  why: Why[],
  componentsById: Map<string, ComponentManifest>,
): string {
  const compatible = qp.compatible[source.id] ?? [];
  const fallbackId = source.default.component ?? compatible[0]!.id;
  if (compatible.length === 1) return compatible[0]!.id;

  const groups = qp.hierarchy[source.id];
  if (!groups) {
    const g = gate(qid(KINDS.component, source.id), KINDS.component);
    const value = g.answer?.type === "choice" ? g.answer.value : fallbackId;
    why.push({ ...g.why, answer: value });
    return value;
  }

  // Hierarchical choice: P(category) * P(component | category), all asked in the same round.
  const cat = gate(qid(KINDS.category, source.id), KINDS.category);
  if (cat.answer?.type !== "choice") {
    why.push({ ...cat.why, answer: componentsById.get(fallbackId)?.category ?? null });
    why.push({
      question: KINDS.component,
      answer: fallbackId,
      decidedBy: cat.why.decidedBy,
      note: "category not decided",
    });
    return fallbackId;
  }
  let best = { id: fallbackId, p: -1 };
  const pCategory = cat.answer.probabilities;
  for (const [category, members] of Object.entries(groups)) {
    if (members.length === 1) {
      const p = pCategory[category] ?? 0;
      if (p > best.p) best = { id: members[0]!.id, p };
      continue;
    }
    const inner = gate(qid(KINDS.component, source.id, category), KINDS.component);
    const pInner =
      inner.answer?.type === "choice" ? inner.answer.probabilities : { [members[0]!.id]: 1 };
    for (const member of members) {
      const p = (pCategory[category] ?? 0) * (pInner[member.id] ?? 0);
      if (p > best.p) best = { id: member.id, p };
    }
  }
  why.push({ ...cat.why, answer: cat.answer.value });
  why.push({
    question: KINDS.component,
    answer: best.id,
    decidedBy: cat.why.decidedBy,
    ...(cat.why.engine ? { engine: cat.why.engine } : {}),
    note: `hierarchical: P(category) x P(component | category) = ${best.p.toFixed(3)}`,
  });
  return best.id;
}

function sha(text: string) {
  return stableHash(text);
}
