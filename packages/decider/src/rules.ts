import { createEngineDecider } from "./engine";
import type { Capabilities, Question, Questions, State } from "./types";
import type { WireAnswer } from "./wire";

/** A rule verdict for one question: the chosen option, level, or truth value. */
export type RuleVerdict =
  | { type: "choice"; value: string }
  | { type: "score"; value: number }
  | { type: "noul"; value: boolean };

/**
 * Resolves a question deterministically. Supplied by the planner from manifest-declared
 * heuristics and defaults; must be a pure function of (question, state).
 */
export type RuleResolver = (question: Question, state: State) => RuleVerdict | undefined;

export const RULES_ENGINE_ID = "rules";

export const RULES_CAPABILITIES: Capabilities = {
  maxStateTokens: Number.MAX_SAFE_INTEGER,
  maxRequestTokens: Number.MAX_SAFE_INTEGER,
  maxQuestionsPerRequest: Number.MAX_SAFE_INTEGER,
  maxChoiceOptions: Number.MAX_SAFE_INTEGER,
  maxCriteriaTokens: Number.MAX_SAFE_INTEGER,
  primitives: ["choice", "score", "noul"],
  languages: ["*"],
  modalities: ["text"],
  locality: "local",
  deterministic: true,
  p50LatencyMs: 0,
  costPerMTok: 0,
};

/**
 * Deterministic decider that needs no model or network. Answers carry all probability mass on
 * the rule verdict. Questions the resolver does not cover fall back to a neutral default:
 * the first choice option, the middle score level, or "false" for nouls.
 */
export function createRuleDecider(resolve: RuleResolver, id = RULES_ENGINE_ID) {
  return createEngineDecider({
    id,
    capabilities: RULES_CAPABILITIES,
    async call(state: State, questions: Questions) {
      const answers: Record<string, WireAnswer> = {};
      for (const [qid, question] of Object.entries(questions)) {
        answers[qid] = toWire(question, resolve(question, state));
      }
      return { answers, engineVersion: id, inputTokens: 0 };
    },
  });
}

function toWire(question: Question, verdict: RuleVerdict | undefined): WireAnswer {
  switch (question.type) {
    case "choice": {
      const options = Object.keys(question.criteria);
      const value =
        verdict?.type === "choice" && options.includes(verdict.value) ? verdict.value : options[0];
      return {
        type: "choice",
        choice: value,
        probabilities: Object.fromEntries(options.map((o) => [o, o === value ? 1 : 0])),
      };
    }
    case "score": {
      const max = question.criteria.length - 1;
      const raw = verdict?.type === "score" ? verdict.value : Math.floor(max / 2);
      const value = Math.min(max, Math.max(0, Math.round(raw)));
      return {
        type: "score",
        score: value,
        probabilities: Object.fromEntries(
          question.criteria.map((_, i) => [String(i), i === value ? 1 : 0]),
        ),
      };
    }
    case "noul":
      return { type: "noul", noul: verdict?.type === "noul" && verdict.value ? 1 : 0 };
  }
}
