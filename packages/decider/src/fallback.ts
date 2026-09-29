import type { AnswerOrUnanswered, Decider, Questions } from "./types";

/**
 * Wrap a primary decider so that engine failures (errors, timeouts, rate limits) are
 * answered by a fallback decider (normally the rules decider). The failure reason is
 * recorded on every affected answer's provenance.
 */
export function withFallback(primary: Decider, fallback: Decider): Decider {
  return {
    id: primary.id,
    capabilities: primary.capabilities,
    async decide(state, questions, options) {
      try {
        return await primary.decide(state, questions, options);
      } catch (error) {
        const reason = describeError(error);
        const result = await fallback.decide(state, questions, options);
        const answers: Record<string, AnswerOrUnanswered> = {};
        for (const [id, answer] of Object.entries(result.answers)) {
          answers[id] = {
            ...answer,
            provenance: { engine: answer.provenance.engine, fallbackReason: reason },
          };
        }
        return { ...result, answers };
      }
    },
  };
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** Questions whose answers were unanswered, e.g. to re-ask them elsewhere. */
export function unansweredIds(answers: Record<string, AnswerOrUnanswered>, questions: Questions) {
  return Object.keys(questions).filter((id) => answers[id]?.type === "unanswered" || !answers[id]);
}
