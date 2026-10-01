/**
 * Produce a submission from an engine (spec: benchmark, design D6). Every item is asked exactly as
 * the dataset states it; the answers are written back in the System One wire format.
 */
import {
  createReplayDecider,
  type Recordings,
  UnrecordedQuestionsError,
} from "@web4kit/conformance";
import {
  type AnswerOrUnanswered,
  type Decider,
  estimateTokens,
  RULES_CAPABILITIES,
} from "@web4kit/decider";
import { buildQuestions } from "@web4kit/planner";
import {
  DATASET_VERSION,
  type Submission,
  type SubmissionLine,
  type SubmissionMeta,
  type WireAnswer,
} from "./format";
import { type BenchSite, itemId, SITES } from "./sites";

/** Request overhead over the estimated state + question tokens, as measured for the precompute. */
export const REQUEST_OVERHEAD = 1.17;

export type EngineFor = (site: BenchSite) => Decider | Promise<Decider>;

export interface RunOptions {
  engineFor: EngineFor;
  repeats: number;
  meta: Omit<SubmissionMeta, "engineVersion" | "dataset" | "repeats" | "createdAt">;
  sites?: BenchSite[];
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function makeSubmission(options: RunOptions): Promise<Submission> {
  const sites = options.sites ?? SITES;
  const jobs: Array<{
    site: BenchSite;
    decider: Decider;
    fixture: string;
    qp: ReturnType<typeof buildQuestions>;
    repeat: number;
  }> = [];
  for (const site of sites) {
    const decider = await options.engineFor(site);
    for (const f of site.fixtures()) {
      const qp = buildQuestions(site.manifests, f.situation, f.intent ? { intent: f.intent } : {});
      for (let repeat = 0; repeat < options.repeats; repeat++)
        jobs.push({ site, decider, fixture: f.name, qp, repeat });
    }
  }
  const lines: SubmissionLine[] = [];
  let engineVersion = "";
  let done = 0;
  // Repeats of one item are asked in order, so a replayed recording serves its repeats in order.
  jobs.sort((a, b) => a.repeat - b.repeat);
  await pool(jobs, options.concurrency ?? 4, async (job) => {
    const started = performance.now();
    const set = await job.decider.decide(job.qp.state, job.qp.questions);
    const latencyMs = Math.round(performance.now() - started);
    engineVersion ||= set.engineVersion;
    lines.push({
      item: itemId(job.site.key, job.fixture),
      repeat: job.repeat,
      answers: Object.fromEntries(
        Object.entries(set.answers).flatMap(([id, a]) => {
          const wire = toWire(a);
          return wire ? [[id, wire]] : [];
        }),
      ),
      inputTokens: set.usage.inputTokens,
      latencyMs,
    });
    options.onProgress?.(++done, jobs.length);
  });
  return {
    meta: {
      ...options.meta,
      engineVersion,
      dataset: DATASET_VERSION,
      repeats: options.repeats,
      createdAt: new Date().toISOString(),
    },
    lines,
  };
}

/** A web4 answer back in the wire format; unanswered and fallback answers are left out. */
export function toWire(a: AnswerOrUnanswered): WireAnswer | undefined {
  if (a.type === "unanswered" || a.provenance.fallbackReason) return undefined;
  switch (a.type) {
    case "choice":
      return { type: "choice", choice: a.value, probabilities: a.probabilities };
    case "score":
      return { type: "score", score: a.value, probabilities: a.probabilities };
    case "noul":
      return { type: "noul", noul: a.value };
  }
}

/** Estimated input tokens for every request a run would send, with the measured overhead. */
export function estimateRun(
  sites: BenchSite[],
  repeats: number,
): { requests: number; tokens: number } {
  let tokens = 0;
  let requests = 0;
  for (const site of sites)
    for (const f of site.fixtures()) {
      const qp = buildQuestions(site.manifests, f.situation, f.intent ? { intent: f.intent } : {});
      tokens += estimateTokens({ state: qp.state, questions: qp.questions }) * repeats;
      requests += repeats;
    }
  return { requests, tokens: Math.round(tokens * REQUEST_OVERHEAD) };
}

/**
 * A decider that answers only from recordings (e.g. the ablation's) and never calls an engine.
 * An unrecorded question set fails, naming the item, instead of being answered.
 */
export function recordingsDecider(recordings: Recordings): EngineFor {
  const replay = createReplayDecider(recordings, { ...RULES_CAPABILITIES, deterministic: false });
  return () => ({
    id: recordings.engine,
    capabilities: replay.capabilities,
    async decide(state, questions) {
      try {
        return await replay.decide(state, questions);
      } catch (e) {
        if (e instanceof UnrecordedQuestionsError)
          throw new Error(
            `no recording for a question set (${e.key}): the questions changed since recording`,
          );
        throw e;
      }
    },
  });
}

/** Merge recordings files of one engine version. */
export function mergeRecordings(all: Recordings[]): Recordings {
  const versions = new Set(all.map((r) => r.engineVersion));
  if (versions.size !== 1)
    throw new Error(`recordings from several engine versions: ${[...versions].join(", ")}`);
  const sets: Recordings["sets"] = {};
  for (const r of all) for (const [k, list] of Object.entries(r.sets)) if (!sets[k]) sets[k] = list;
  return { engine: all[0]!.engine, engineVersion: all[0]!.engineVersion, sets };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}
