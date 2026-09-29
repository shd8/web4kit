import type { BucketSpec, Situation } from "@web4kit/context";
import { estimateTokens } from "@web4kit/decider";
import type { ManifestSet } from "@web4kit/manifest";
import {
  buildQuestions,
  INTENT_MAX_CHARS,
  PORTABILITY,
  PortabilityError,
  type PortabilityLimits,
} from "./questions";

/**
 * Build-time portability lint (design D6): every generated question must fit Laya-class
 * limits. Uses a worst-case situation (longest label per bucket) and, optionally, a
 * maximum-length intent.
 */
export function lintPortability(
  manifests: ManifestSet,
  buckets: BucketSpec,
  options: { withIntent?: boolean; limits?: PortabilityLimits } = {},
): { stateTokens: number; questions: number } {
  const limits = options.limits ?? PORTABILITY;
  const worst: Situation = Object.fromEntries(
    Object.entries(buckets).map(([bucket, labels]) => [
      bucket,
      labels.length ? [...labels].sort((a, b) => b.length - a.length)[0]! : "portuguese",
    ]),
  );
  const intent = options.withIntent
    ? { text: "x".repeat(INTENT_MAX_CHARS), language: "english" }
    : undefined;
  const plan = buildQuestions(manifests, worst, { ...(intent ? { intent } : {}), limits });
  const issues: string[] = [];

  const stateTokens = estimateTokens(plan.state);
  if (stateTokens >= limits.maxStateTokens) {
    issues.push(`state: ${stateTokens} tokens (limit < ${limits.maxStateTokens})`);
  }
  for (const [id, question] of Object.entries(plan.questions)) {
    if (question.type === "choice") {
      const options = Object.keys(question.criteria).length;
      if (options > limits.maxChoiceOptions) {
        issues.push(
          `${id}: ${options} options (limit < ${limits.maxChoiceOptions + 1}); declare component categories`,
        );
      }
    }
    if (question.type !== "noul") {
      const tokens = estimateTokens(question.criteria);
      if (tokens > limits.maxCriteriaTokens) {
        issues.push(`${id}: criteria ${tokens} tokens (limit ${limits.maxCriteriaTokens})`);
      }
    }
  }
  if (issues.length) throw new PortabilityError(issues);
  return { stateTokens, questions: Object.keys(plan.questions).length };
}
