import { type Situation, situationHash } from "@web4/context";
import {
  type Answer,
  type AnswerOrUnanswered,
  type AnswerSet,
  type Decider,
  RULES_ENGINE_ID,
  withFallback,
} from "@web4/decider";
import {
  DEVICES,
  type Device,
  PLAN_FORMAT,
  type Plan,
  REGIONS,
  type Region,
  stableHash,
  type Why,
} from "@web4/ir";
import type { ComponentManifest, DataSourceManifest, ManifestSet } from "@web4/manifest";
import { SALIENCE_LEVELS } from "@web4/manifest";
import { type Candidate, solve } from "@web4/solver";
import { type PlanCache, planCacheKey } from "./cache";
import { acceptThreshold, type CalibrationProfile } from "./calibration";
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
  plan(request: PlanRequest): Promise<PlanResult>;
}

const NO_CALIBRATION = "cal-none";

export function createPlanner(config: PlannerConfig): Planner {
  const { manifests } = config;
  const rules = createManifestRuleDecider(manifests);
  const engine = config.decider ?? rules;
  const isRules = engine.id === RULES_ENGINE_ID;
  const decider = isRules ? rules : withFallback(engine, rules);
  const calibrationVersion = isRules ? "rules" : (config.calibration?.version ?? NO_CALIBRATION);

  return {
    engineId: engine.id,
    async plan(request) {
      const started = performance.now();
      const hash = situationHash(request.situation);
      const key = planCacheKey({
        site: manifests.site,
        situationHash: hash,
        manifestVersion: manifests.version,
        engineId: engine.id,
        calibrationVersion,
        ...(request.intent ? { intentHash: sha(request.intent.text) } : {}),
      });
      const cached = config.cache?.get(key);
      if (cached) {
        return {
          plan: cached,
          cacheHit: true,
          planningMs: performance.now() - started,
          usage: { requests: 0, inputTokens: 0 },
        };
      }

      const qp = buildQuestions(
        manifests,
        request.situation,
        request.intent ? { intent: request.intent } : {},
      );
      // One logical round: every stage question for every candidate at once.
      const answers = await decider.decide(qp.state, qp.questions);
      const ruleAnswers = isRules ? answers : await rules.decide(qp.state, qp.questions);
      const language = request.intent?.language ?? config.inputLanguage ?? "english";

      const gate = createGate({
        isRules,
        engineId: engine.id,
        calibration: config.calibration,
        language,
        answers,
        ruleAnswers,
      });

      const plan = assemble({
        manifests,
        situation: request.situation,
        situationHash: hash,
        engineId: engine.id,
        calibrationVersion,
        qp,
        gate,
      });
      config.cache?.set(key, plan);
      return {
        plan,
        cacheHit: false,
        planningMs: performance.now() - started,
        usage: { requests: answers.usage.requests, inputTokens: answers.usage.inputTokens },
      };
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
  engineId: string;
  calibration: CalibrationProfile | undefined;
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
    const threshold = acceptThreshold(ctx.calibration, kind, ctx.language);
    const measured = {
      probabilities: answer.probabilities,
      confidence: answer.confidence,
      engine: answer.provenance.engine,
    };
    if (threshold === undefined) {
      const r = asRule(`uncalibrated: ${kind}|${ctx.language}`);
      // Record the engine's measured answer (engine = who was overridden), decided by rule.
      return {
        answer: r.answer,
        why: { ...r.why, ...measured, decidedBy: "rule", threshold: null },
      };
    }
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
    const forced = source.mustInclude ? matches(source.mustInclude, situation) : false;
    const include = (relevant && salience >= 0.5) || forced;
    if (forced && !(relevant && salience >= 0.5)) {
      why.push({
        question: "invariant.must-include",
        answer: true,
        decidedBy: "invariant",
        note: `required when ${JSON.stringify(source.mustInclude)}`,
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

/** A forced source is also made prominent (e.g. "closed" must be visible, not buried). */
function situationForcesProminence(source: DataSourceManifest, situation: Situation) {
  return source.mustInclude !== undefined && matches(source.mustInclude, situation);
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
