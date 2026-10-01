import type { Situation } from "@web4kit/context";
import type { AnswerOrUnanswered, AnswerSet, Decider, Questions, State } from "@web4kit/decider";
import { type Plan, REGIONS, stableHash } from "@web4kit/ir";
import type { ManifestSet } from "@web4kit/manifest";
import {
  buildQuestions,
  type CalibrationProfile,
  calibrationKey,
  createPlanner,
  type QuestionIndexEntry,
} from "@web4kit/planner";
import {
  type CalibrateOptions,
  calibrateEntry,
  DEFAULT_CALIBRATE,
  type Observation,
} from "./calibrate";
import { checkInvariants, type ExpectedAnswer, type SituatedFixture } from "./fixtures";

export interface EngineRun {
  engine: string;
  engineVersion: string;
  skipped?: string;
  fixtures: number;
  labelled: number;
  /** Answers produced by the fallback because the engine failed (excluded from measurement). */
  engineFailures: number;
  repeats: number;
  byKind: Record<string, KindStats>;
  /**
   * Labels scored against what the final plan decided (after gating, defaults, invariants and
   * fallbacks): what a visitor actually gets. Keyed by `${kind}|${language}`.
   */
  decisionAccuracy: Record<string, { samples: number; accuracy: number }>;
  invariantPassRate: number;
  invariantFailures: Array<{ fixture: string; detail: string }>;
  latencyMs: { p50: number; p95: number };
  inputTokensPerPlan: number;
  costPerPlanUsd: number;
  profile?: CalibrationProfile;
}

export interface KindStats {
  kind: string;
  language: string;
  samples: number;
  accuracy: number;
  meanConfidenceCorrect: number;
  meanConfidenceIncorrect: number;
  /** Histogram buckets [0,0.1),...,[0.9,1] for correct and incorrect answers. */
  histogram: { correct: number[]; incorrect: number[] };
  flipRate?: number;
  threshold?: number;
  uncalibrated?: boolean;
}

export interface RunOptions {
  manifests: ManifestSet;
  fixtures: SituatedFixture[];
  decider: Decider;
  repeats?: number;
  concurrency?: number;
  calibrate?: CalibrateOptions;
  onProgress?: (done: number, total: number) => void;
}

/** Plan every fixture with one engine, measure it, and generate its calibration profile. */
export async function runEngine(options: RunOptions): Promise<EngineRun> {
  const { manifests, fixtures, decider } = options;
  const deterministic = decider.capabilities.deterministic === true;
  const repeats = deterministic ? 1 : Math.max(1, options.repeats ?? 3);

  // Phase 1: measure raw answers (repeats for non-deterministic engines).
  const recorded = new Map<string, AnswerSet[]>();
  const latencies: number[] = [];
  let tokens = 0;
  const jobs = fixtures.flatMap((f) => Array.from({ length: repeats }, (_, r) => ({ f, r })));
  let done = 0;
  await pool(jobs, options.concurrency ?? 4, async ({ f }) => {
    const qp = buildQuestions(manifests, f.situation, f.intent ? { intent: f.intent } : {});
    const started = performance.now();
    let answers: AnswerSet;
    try {
      answers = await decider.decide(qp.state, qp.questions);
    } catch (e) {
      throw new Error(`fixture ${f.name}: ${e instanceof Error ? e.message : String(e)}`, {
        cause: e,
      });
    }
    latencies.push(performance.now() - started);
    tokens += answers.usage.inputTokens;
    const list = recorded.get(f.name) ?? [];
    list.push(answers);
    recorded.set(f.name, list);
    options.onProgress?.(++done, jobs.length);
  });
  const engineVersion = [...recorded.values()][0]?.[0]?.engineVersion ?? decider.id;

  // Phase 2: correctness and flip rate per kind|language.
  const observations = new Map<string, Observation[]>();
  const flips = new Map<string, { flipped: number; total: number }>();
  let labelled = 0;
  let engineFailures = 0;
  for (const f of fixtures) {
    const sets = recorded.get(f.name) ?? [];
    const qp = buildQuestions(manifests, f.situation, f.intent ? { intent: f.intent } : {});
    const language = f.intent?.language ?? "english";
    for (const expected of f.expected ?? []) {
      const ids = questionIdsFor(qp.index, expected);
      for (const id of ids) {
        for (const set of sets) {
          const answer = set.answers[id];
          if (!answer || answer.type === "unanswered") continue;
          if (answer.provenance.fallbackReason) {
            engineFailures++;
            continue;
          }
          const key = calibrationKey(expected.kind, language);
          const list = observations.get(key) ?? [];
          list.push({
            kind: expected.kind,
            language,
            confidence: answer.confidence,
            correct: isCorrect(answer, expected),
          });
          observations.set(key, list);
          labelled++;
        }
      }
    }
    if (sets.length > 1) {
      for (const [id, entry] of Object.entries(qp.index)) {
        const key = calibrationKey(entry.kind, language);
        const values = sets.map((s) => discrete(s.answers[id]));
        const stat = flips.get(key) ?? { flipped: 0, total: 0 };
        stat.total++;
        if (new Set(values).size > 1) stat.flipped++;
        flips.set(key, stat);
      }
    }
  }

  const byKind: Record<string, KindStats> = {};
  const entries: CalibrationProfile["entries"] = {};
  for (const [key, obs] of observations) {
    const [kind, language] = key.split("|") as [string, string];
    const flip = flips.get(key);
    const flipRate = flip ? flip.flipped / flip.total : undefined;
    const entry = calibrateEntry(obs, flipRate, options.calibrate ?? DEFAULT_CALIBRATE);
    if (entry) entries[key] = entry;
    const correct = obs.filter((o) => o.correct);
    const incorrect = obs.filter((o) => !o.correct);
    byKind[key] = {
      kind,
      language,
      samples: obs.length,
      accuracy: correct.length / obs.length,
      meanConfidenceCorrect: mean(correct.map((o) => o.confidence)),
      meanConfidenceIncorrect: mean(incorrect.map((o) => o.confidence)),
      histogram: { correct: histogram(correct), incorrect: histogram(incorrect) },
      ...(flipRate !== undefined ? { flipRate } : {}),
      ...(entry && !entry.uncalibrated ? { threshold: entry.acceptThreshold } : {}),
      ...(entry?.uncalibrated ? { uncalibrated: true } : {}),
    };
  }
  const profile: CalibrationProfile = {
    engine: engineVersion,
    version: `cal-${stableHash(JSON.stringify({ engineVersion, manifests: manifests.deciderVersion, entries }), 10)}`,
    manifestVersion: manifests.deciderVersion,
    createdAt: new Date().toISOString(),
    entries,
  };

  // Phase 3: invariants, planning with the generated profile and the recorded first answers.
  const failures: EngineRun["invariantFailures"] = [];
  const decisions = new Map<string, { met: number; total: number }>();
  let checks = 0;
  for (const f of fixtures) {
    const first = recorded.get(f.name)?.[0];
    if (!first) continue;
    const replay: Decider = {
      id: decider.id,
      capabilities: decider.capabilities,
      decide: async () => first,
    };
    const planner = createPlanner({ manifests, decider: replay, calibration: profile });
    const { plan } = await planner.plan({
      situation: f.situation,
      ...(f.intent ? { intent: f.intent } : {}),
    });
    for (const result of checkInvariants(plan, f.invariants)) {
      checks++;
      if (!result.ok) failures.push({ fixture: f.name, detail: result.detail });
    }
    const language = f.intent?.language ?? "english";
    for (const expected of f.expected ?? []) {
      const key = calibrationKey(expected.kind, language);
      const stat = decisions.get(key) ?? { met: 0, total: 0 };
      stat.total++;
      if (decisionMeets(plan, expected)) stat.met++;
      decisions.set(key, stat);
    }
  }

  const plans = fixtures.length * repeats;
  const inputTokensPerPlan = plans ? tokens / plans : 0;
  return {
    engine: decider.id,
    engineVersion,
    fixtures: fixtures.length,
    labelled,
    engineFailures,
    repeats,
    byKind,
    decisionAccuracy: Object.fromEntries(
      [...decisions].map(([key, { met, total }]) => [
        key,
        { samples: total, accuracy: met / total },
      ]),
    ),
    invariantPassRate: checks ? (checks - failures.length) / checks : 1,
    invariantFailures: failures,
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    inputTokensPerPlan,
    costPerPlanUsd: (inputTokensPerPlan / 1e6) * decider.capabilities.costPerMTok,
    profile,
  };
}

function questionIdsFor(
  index: Record<string, QuestionIndexEntry>,
  expected: ExpectedAnswer,
): string[] {
  return Object.entries(index)
    .filter(([, e]) => e.kind === expected.kind && e.sourceId === expected.source && !e.category)
    .map(([id]) => id);
}

export function isCorrect(
  answer: Exclude<AnswerOrUnanswered, { type: "unanswered" }>,
  expected: ExpectedAnswer,
): boolean {
  switch (answer.type) {
    case "choice":
      return expected.accept.includes(answer.value);
    case "noul":
      return expected.accept.includes(answer.value >= 0.5);
    case "score":
      return expected.accept.includes(Math.round(answer.value));
  }
}

/**
 * Whether the final plan meets a label. Relevance is judged by what the visitor sees (the
 * source is placed or not); the other kinds by the placed block's decision. A label about a
 * source that is not placed is unmet for every kind except "not relevant".
 */
export function decisionMeets(plan: Plan, expected: ExpectedAnswer): boolean {
  let region: string | undefined;
  let block: Plan["layout"]["primary"][number] | undefined;
  for (const r of REGIONS) {
    const found = plan.layout[r].find((b) => b.sourceId === expected.source);
    if (found) {
      region = r;
      block = found;
      break;
    }
  }
  switch (expected.kind) {
    case "A.relevance":
      return expected.accept.includes(block !== undefined);
    case "A.salience": {
      const why = block?.why.find((w) => w.question === "A.salience");
      return typeof why?.answer === "number" && expected.accept.includes(Math.round(why.answer));
    }
    case "B.component":
      return block !== undefined && expected.accept.includes(block.componentId);
    case "C.region":
      return region !== undefined && expected.accept.includes(region);
    case "C.prominence":
      return block !== undefined && expected.accept.includes(Math.round(block.prominence));
    default:
      return false;
  }
}

function discrete(a: AnswerOrUnanswered | undefined): string {
  if (!a || a.type === "unanswered") return "?";
  if (a.type === "noul") return String(a.value >= 0.5);
  if (a.type === "score") return String(Math.round(a.value));
  return a.value;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function percentile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}
function histogram(obs: Observation[]) {
  const h = Array.from({ length: 10 }, () => 0);
  for (const o of obs) h[Math.min(9, Math.floor(o.confidence * 10))]!++;
  return h;
}

export type { Questions, Situation, State };
