import { distributionConfidence, normalizeRecord, noulConfidence } from "./confidence";
import type { AnswerOrUnanswered, Provenance, Question } from "./types";

/** A raw answer as returned over the System One wire format. */
export interface WireAnswer {
  type?: string;
  choice?: unknown;
  score?: unknown;
  noul?: unknown;
  confidence?: unknown;
  probabilities?: unknown;
}

/**
 * Validate a raw engine answer against its question and normalize it into a web4 answer.
 * Answers outside the supplied option set are reported as unanswered (spec: decider).
 */
export function normalizeWireAnswer(
  question: Question,
  raw: WireAnswer | undefined,
  provenance: Provenance,
): AnswerOrUnanswered {
  const unanswered = (reason: string): AnswerOrUnanswered => ({
    type: "unanswered",
    reason,
    provenance,
  });
  if (!raw || typeof raw !== "object") return unanswered("missing answer");
  if (raw.type !== undefined && raw.type !== question.type) {
    return unanswered(`type mismatch: expected ${question.type}, got ${String(raw.type)}`);
  }
  const engineConfidence = typeof raw.confidence === "number" ? raw.confidence : undefined;

  switch (question.type) {
    case "choice": {
      const options = Object.keys(question.criteria);
      if (typeof raw.choice !== "string" || !options.includes(raw.choice)) {
        return unanswered(`choice outside option set: ${JSON.stringify(raw.choice)}`);
      }
      const probs = readProbabilities(raw.probabilities, options);
      if (!probs) return unanswered("probabilities missing or not covering the option set");
      return {
        type: "choice",
        value: raw.choice,
        probabilities: probs,
        confidence: distributionConfidence(probs),
        ...(engineConfidence !== undefined ? { engineConfidence } : {}),
        provenance,
      };
    }
    case "score": {
      const levels = question.criteria.map((_, i) => String(i));
      const max = levels.length - 1;
      if (typeof raw.score !== "number" || raw.score < 0 || raw.score > max) {
        return unanswered(`score outside level range 0..${max}: ${JSON.stringify(raw.score)}`);
      }
      const probs = readProbabilities(raw.probabilities, levels);
      if (!probs) return unanswered("probabilities missing or not covering the levels");
      return {
        type: "score",
        value: raw.score,
        probabilities: probs,
        confidence: distributionConfidence(probs),
        ...(engineConfidence !== undefined ? { engineConfidence } : {}),
        provenance,
      };
    }
    case "noul": {
      if (typeof raw.noul !== "number" || raw.noul < 0 || raw.noul > 1) {
        return unanswered(`noul outside 0..1: ${JSON.stringify(raw.noul)}`);
      }
      return {
        type: "noul",
        value: raw.noul,
        probabilities: { true: raw.noul, false: 1 - raw.noul },
        confidence: noulConfidence(raw.noul),
        ...(engineConfidence !== undefined ? { engineConfidence } : {}),
        provenance,
      };
    }
  }
}

function readProbabilities(raw: unknown, keys: string[]): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const v = record[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
    out[key] = v;
  }
  return normalizeRecord(out);
}

/** Strip web4-only fields so a question can be sent over the wire. */
export function toWireQuestion(question: Question): Record<string, unknown> {
  const { meta: _meta, ...wire } = question;
  return wire;
}
