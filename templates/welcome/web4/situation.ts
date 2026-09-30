import {
  CORE_BUCKETS,
  CORE_RULES,
  type ContextEnvelope,
  DAY_PART_BUCKET,
  dayPartRule,
  deriveSituation,
  type SituationRule,
} from "@web4kit/context";

/** Time zone used when the request carries none (CDN geo headers set one in production). */
const SERVER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The visitor's part of the day, in their own time zone when known. */
const visitorDayPart: SituationRule = (env) =>
  dayPartRule({ timezone: env.timezone ?? env.geo?.timezone ?? SERVER_TIMEZONE })(env);

/**
 * Situation rules turn the request into English labels from closed sets. System One models only
 * ever see these labels: add your own rules here (all maths belongs in code, not in the model).
 */
export const RULES: SituationRule[] = [...CORE_RULES, visitorDayPart];
export const BUCKETS = { ...CORE_BUCKETS, ...DAY_PART_BUCKET };

export function situationOf(envelope: ContextEnvelope) {
  return deriveSituation(envelope, RULES);
}
