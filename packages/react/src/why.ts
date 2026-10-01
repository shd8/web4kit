import type { DecidedBy, Why } from "@web4kit/ir";

/**
 * Shared formatting of a plan's Why records, used by the X-ray overlay and the lab's Why panel
 * so both explain a decision the same way.
 */

/** Display name and tone of each decider. `ungated` only appears in development plans. */
export const DECIDED_BY: Record<
  DecidedBy,
  { label: string; tone: "green" | "blue" | "amber" | "orange" | "red" }
> = {
  engine: { label: "engine", tone: "green" },
  rule: { label: "rule", tone: "blue" },
  default: { label: "default", tone: "amber" },
  invariant: { label: "invariant", tone: "orange" },
  ungated: { label: "ungated in dev", tone: "red" },
};

/** Question kind without the `invariant.` prefix, e.g. "C.region" or "must-include". */
export const whyLabel = (why: Why) => why.question.replace(/^invariant\./, "");

export const formatAnswer = (why: Why) =>
  typeof why.answer === "number" ? why.answer.toFixed(2) : String(why.answer);

/** Probability of the chosen answer, when the record has probabilities for it. */
export function answerProbability(why: Why): number | undefined {
  const p = why.probabilities;
  if (!p) return undefined;
  if (typeof why.answer === "boolean") return why.answer ? p.true : p.false;
  if (typeof why.answer === "string") return p[why.answer];
  if (typeof why.answer === "number") return p[String(why.answer)];
  return undefined;
}

/** One line per fact: answer, confidence, threshold, who decided, note, probabilities. */
export function whyDetails(why: Why): string[] {
  return [
    `${why.question} → ${formatAnswer(why)}`,
    why.confidence !== undefined ? `confidence ${why.confidence.toFixed(2)}` : "",
    why.threshold !== undefined && why.threshold !== null
      ? `threshold ${why.threshold.toFixed(2)}`
      : "",
    `decided by ${DECIDED_BY[why.decidedBy].label}${why.engine ? ` (${why.engine})` : ""}`,
    why.note ?? "",
    why.probabilities
      ? `p: ${Object.entries(why.probabilities)
          .map(([k, v]) => `${k}=${v.toFixed(2)}`)
          .join(" ")}`
      : "",
  ].filter(Boolean);
}
