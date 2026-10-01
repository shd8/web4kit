import type { AnswerSet, Decider, Questions, State } from "@web4kit/decider";
import { stableHash } from "@web4kit/ir";

/** Recorded answer sets by question-set key, in call order (one per repeat). */
export interface Recordings {
  engine: string;
  engineVersion: string;
  sets: Record<string, AnswerSet[]>;
}

/** Stable key of one decider request: the exact state and questions asked. */
export const recordingKey = (state: State, questions: Questions) =>
  stableHash(JSON.stringify({ state, questions }), 16);

/**
 * Wraps an engine and records every answer set it returns, so a run can be re-scored (or
 * replayed under different rules-side settings) without spending again.
 */
export function createRecordingDecider(inner: Decider): Decider & { recordings(): Recordings } {
  const sets: Record<string, AnswerSet[]> = {};
  let engineVersion = inner.id;
  return {
    id: inner.id,
    capabilities: inner.capabilities,
    async decide(state, questions, options) {
      const answers = await inner.decide(state, questions, options);
      const key = recordingKey(state, questions);
      const list = sets[key] ?? [];
      list.push(answers);
      sets[key] = list;
      engineVersion = answers.engineVersion;
      return answers;
    },
    recordings: () => ({ engine: inner.id, engineVersion, sets }),
  };
}

export class UnrecordedQuestionsError extends Error {
  constructor(readonly key: string) {
    super(`no recorded answers for question set ${key}: the questions changed since recording`);
    this.name = "UnrecordedQuestionsError";
  }
}

/**
 * Serves recorded answer sets without calling any engine. The n-th request for a question set
 * gets its n-th recording (cycling), so repeats keep their spread. Unknown question sets fail.
 */
export function createReplayDecider(
  recordings: Recordings,
  capabilities: Decider["capabilities"],
): Decider & { calls(): number } {
  const served: Record<string, number> = {};
  let calls = 0;
  return {
    id: recordings.engine,
    capabilities,
    async decide(state, questions) {
      const key = recordingKey(state, questions);
      const list = recordings.sets[key];
      if (!list?.length) throw new UnrecordedQuestionsError(key);
      const n = served[key] ?? 0;
      served[key] = n + 1;
      calls++;
      return list[n % list.length]!;
    },
    calls: () => calls,
  };
}
