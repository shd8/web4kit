import type { Capabilities, Question, Questions, State } from "./types";
import { toWireQuestion } from "./wire";

/** Rough token estimate (~4 characters per token) used for request budgeting. */
export function estimateTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil((text?.length ?? 0) / 4);
}

export function questionTokens(question: Question): number {
  return estimateTokens(toWireQuestion(question));
}

/**
 * Split independent questions into batches that each fit the engine's per-request limits.
 * Every batch carries the same state; batches have no ordering dependency and are sent concurrently.
 */
export function planBatches(
  state: State,
  questions: Questions,
  capabilities: Pick<Capabilities, "maxRequestTokens" | "maxQuestionsPerRequest">,
): Questions[] {
  const stateTokens = estimateTokens(state);
  const budget = Math.max(1, capabilities.maxRequestTokens - stateTokens);
  const batches: Questions[] = [];
  let current: Questions = {};
  let currentTokens = 0;
  let currentCount = 0;

  for (const [id, question] of Object.entries(questions)) {
    const tokens = questionTokens(question);
    const full =
      currentCount >= capabilities.maxQuestionsPerRequest ||
      (currentCount > 0 && currentTokens + tokens > budget);
    if (full) {
      batches.push(current);
      current = {};
      currentTokens = 0;
      currentCount = 0;
    }
    current[id] = question;
    currentTokens += tokens;
    currentCount += 1;
  }
  if (currentCount > 0) batches.push(current);
  return batches;
}
