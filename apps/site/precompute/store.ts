import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { recordingKey } from "@web4kit/conformance";
import type { AnswerSet, Decider } from "@web4kit/decider";
import { stableJsonCompact } from "./json";

/** Usage measured when a situation was planned live; replays keep it (design D3). */
export interface PlanUsage {
  inputTokens: number;
  requests: number;
  planningMs: number;
}

/** One site's recorded engine answers, committed gzipped so re-runs are free. */
export interface SiteRecordings {
  engine: string;
  /** Question-set key -> the answer set the engine returned. */
  sets: Record<string, AnswerSet>;
  /** Question-set key -> when it was recorded (ISO). */
  recordedAt: Record<string, string>;
  /** Situation hash -> usage of its original planning. */
  usage: Record<string, PlanUsage>;
}

export const emptyRecordings = (engine: string): SiteRecordings => ({
  engine,
  sets: {},
  recordedAt: {},
  usage: {},
});

export function loadRecordings(file: string): SiteRecordings | undefined {
  if (!existsSync(file)) return undefined;
  return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as SiteRecordings;
}

/** Deterministic: sorted keys, and gzip without a timestamp. */
export function saveRecordings(file: string, recordings: SiteRecordings) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, gzipSync(Buffer.from(stableJsonCompact(recordings)), { level: 9 }));
}

export class EngineFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineFailure";
  }
}

export class MissingRecording extends Error {
  constructor(readonly key: string) {
    super(`no recorded answers for question set ${key} (run with --yes to plan it)`);
    this.name = "MissingRecording";
  }
}

/**
 * A decider that answers from the recordings and, when given a live engine, plans and records
 * what is missing. Any live failure is fatal: the planner would otherwise fall back to rules and
 * the bundle would silently hold degraded plans (spec: plan-precompute).
 */
export function createStoreDecider(
  recordings: SiteRecordings,
  capabilities: Decider["capabilities"],
  live?: Decider,
  now: () => Date = () => new Date(),
): Decider & { failures: string[]; liveCalls(): number } {
  const failures: string[] = [];
  let liveCalls = 0;
  return {
    id: live?.id ?? recordings.engine,
    capabilities: live?.capabilities ?? capabilities,
    failures,
    liveCalls: () => liveCalls,
    async decide(state, questions, options) {
      const key = recordingKey(state, questions);
      const recorded = recordings.sets[key];
      if (recorded) return recorded;
      if (!live) {
        failures.push(new MissingRecording(key).message);
        throw new MissingRecording(key);
      }
      liveCalls++;
      try {
        const answers = await live.decide(state, questions, options);
        const failed = Object.values(answers.answers).find((a) => a.provenance?.fallbackReason)
          ?.provenance.fallbackReason;
        if (failed) throw new EngineFailure(failed);
        recordings.sets[key] = answers;
        recordings.recordedAt[key] = now().toISOString();
        return answers;
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
  };
}
