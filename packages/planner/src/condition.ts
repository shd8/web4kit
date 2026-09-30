import type { Situation } from "@web4kit/context";
import type { Condition } from "@web4kit/manifest";

/**
 * True when every bucket of the condition has one of its listed labels. `"always"` (allowed for
 * `mustInclude`) always holds; an absent condition never does.
 */
export function matches(
  condition: Condition | "always" | undefined,
  situation: Situation,
): boolean {
  if (condition === undefined) return false;
  if (condition === "always") return true;
  return Object.entries(condition).every(([bucket, labels]) =>
    labels.includes(situation[bucket] ?? ""),
  );
}
