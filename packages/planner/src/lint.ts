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

/** Day-scale time words: content that is only true at some times of day. */
const TIME_WORDS =
  /\b(today|tonight|this (morning|afternoon|evening)|at night|until \d{1,2}(:\d{2})?)\b/i;

/**
 * Authoring lint: warnings, not errors. A source whose `what` is time-bound ("this morning's
 * breakfast", "today's arrival") but has no `audience` is offered to every visitor at any time.
 * In the zero-config ablation (reports/ablation/zero-config-z2) that was the main cause of wrong
 * pages, and `audience` with `default.include: false` fixed it. With the site's buckets, the
 * fix names its time-of-day bucket.
 */
export function lintManifests(manifests: ManifestSet, buckets?: BucketSpec): string[] {
  const timeBucket = Object.entries(buckets ?? {}).find(([, labels]) =>
    ["morning", "night"].every((l) => labels.includes(l)),
  )?.[0];
  const fix = timeBucket
    ? `add audience: { ${timeBucket}: [...] } and default: { include: false }`
    : "add an audience on a time-of-day bucket (dayPartRule) and default: { include: false }";
  return manifests.sources.flatMap((s) => {
    const word = s.audience ? null : TIME_WORDS.exec(s.what)?.[0];
    return word
      ? [
          `source ${s.id}: \`what\` says "${word}" but there is no audience, so engines may show it at any time; ${fix}`,
        ]
      : [];
  });
}
