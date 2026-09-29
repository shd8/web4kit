import { planBatches } from "./fitting";
import type {
  AnswerOrUnanswered,
  AnswerSet,
  Capabilities,
  DecideOptions,
  Decider,
  Questions,
  State,
} from "./types";
import { normalizeWireAnswer, type WireAnswer } from "./wire";

/** One raw engine round trip: a single System One request. */
export type EngineCall = (
  state: State,
  questions: Questions,
  options?: DecideOptions,
) => Promise<{
  answers: Record<string, WireAnswer | undefined>;
  /** Exact version reported by the engine for this request. */
  engineVersion: string;
  inputTokens: number;
}>;

/**
 * Build a Decider from a raw engine call. Handles request fitting (concurrent batches),
 * answer validation, and uniform confidence, so every adapter behaves identically.
 */
export function createEngineDecider(config: {
  id: string;
  capabilities: Capabilities;
  call: EngineCall;
}): Decider {
  return {
    id: config.id,
    capabilities: config.capabilities,
    async decide(state, questions, options) {
      const batches = planBatches(state, questions, config.capabilities);
      const results = await Promise.all(batches.map((batch) => config.call(state, batch, options)));
      const answers: Record<string, AnswerOrUnanswered> = {};
      let inputTokens = 0;
      const versions = new Set<string>();
      results.forEach((result, i) => {
        const batch = batches[i] ?? {};
        versions.add(result.engineVersion);
        inputTokens += result.inputTokens;
        for (const [id, question] of Object.entries(batch)) {
          answers[id] = normalizeWireAnswer(question, result.answers[id], {
            engine: result.engineVersion,
          });
        }
      });
      const engineVersion = versions.size === 1 ? [...versions][0]! : [...versions].join("+");
      return {
        answers,
        engineVersion: engineVersion || config.id,
        usage: { inputTokens, requests: batches.length },
      } satisfies AnswerSet;
    },
  };
}
