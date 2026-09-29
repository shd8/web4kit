import { type Plan, PlanValidationError } from "./plan";

const PATTERNS: Array<[name: string, pattern: RegExp]> = [
  ["IPv4 address", /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/],
  ["IPv6 address", /\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/i],
  ["URL", /\bhttps?:\/\/\S+/i],
  ["email address", /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/],
];

export interface SensitiveValues {
  /** Raw Context Envelope values and visitor identifiers for the current request. */
  envelope?: Iterable<string>;
  /** Fetched data values (menu items, review texts, ...) for the plan's sources. */
  data?: Iterable<string>;
}

/**
 * Reject plans that carry user or fetched data (spec: page-plan-ir). Plans are shared across
 * every visitor in a situation, so they may only contain decisions and manifest-level ids.
 */
export function assertNoUserData(plan: Plan, sensitive: SensitiveValues = {}): void {
  const found: string[] = [];
  const forbidden = [...(sensitive.envelope ?? []), ...(sensitive.data ?? [])]
    .map((v) => v.trim())
    .filter((v) => v.length >= 4);

  for (const text of collectStrings(plan)) {
    for (const [name, pattern] of PATTERNS) {
      if (pattern.test(text)) found.push(`${name} in "${truncate(text)}"`);
    }
    for (const value of forbidden) {
      if (text.includes(value)) found.push(`user or fetched value "${truncate(value)}"`);
    }
  }
  if (found.length > 0) {
    throw new PlanValidationError(`plan contains user or fetched data: ${found.join("; ")}`, found);
  }
}

function* collectStrings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const v of value) yield* collectStrings(v);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      yield k;
      yield* collectStrings(v);
    }
  }
}

function truncate(s: string): string {
  return s.length > 40 ? `${s.slice(0, 37)}...` : s;
}
