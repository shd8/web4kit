import type { AnswerOrUnanswered, Decider, Question, Questions } from "./types";

/**
 * Cascade (design D2): answer with a cheap engine first; re-ask only the questions whose
 * answer is below the calibrated threshold (or unanswered) on a stronger engine.
 * `threshold` returns the calibrated accept threshold for the cheap engine, or undefined when
 * that question kind is uncalibrated (always escalated).
 */
export function createCascadeDecider(config: {
  cheap: Decider;
  strong: Decider;
  threshold: (question: Question) => number | undefined;
  id?: string;
}): Decider {
  const { cheap, strong } = config;
  return {
    id: config.id ?? `cascade(${cheap.id}>${strong.id})`,
    capabilities: {
      ...strong.capabilities,
      locality: cheap.capabilities.locality,
      deterministic: false,
      p50LatencyMs: cheap.capabilities.p50LatencyMs,
      costPerMTok: cheap.capabilities.costPerMTok,
    },
    async decide(state, questions, options) {
      const first = await cheap.decide(state, questions, options);
      const escalate: Questions = {};
      for (const [id, question] of Object.entries(questions)) {
        const answer = first.answers[id];
        const t = config.threshold(question);
        if (!answer || answer.type === "unanswered" || t === undefined || answer.confidence < t) {
          escalate[id] = question;
        }
      }
      if (Object.keys(escalate).length === 0) return first;
      const second = await strong.decide(state, escalate, options);
      const answers: Record<string, AnswerOrUnanswered> = { ...first.answers, ...second.answers };
      return {
        answers,
        engineVersion: `${first.engineVersion}>${second.engineVersion}`,
        usage: {
          inputTokens: first.usage.inputTokens + second.usage.inputTokens,
          requests: first.usage.requests + second.usage.requests,
        },
      };
    },
  };
}
