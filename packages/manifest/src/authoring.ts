import type { Condition, DataSourceManifestInput, FetchContext, Salience, Trust } from "./schema";

/**
 * Bump when the planner's question wording or the rendered audience phrasing changes: both are
 * part of what a decider sees, so calibration measured before the change no longer applies.
 */
export const QUESTION_TEMPLATE_VERSION = 2;

const or = (labels: string[]) =>
  labels.length < 2 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}`;

/**
 * The one phrasing of an audience condition used in every decider question. It names the
 * accepted labels and states the complement, instead of listing exclusions that can go stale.
 */
export function describeAudience(audience: Condition): string {
  const buckets = Object.keys(audience);
  const clauses = buckets.map((b) => `whose ${b} is ${or(audience[b]!)}`);
  const others =
    buckets.length === 1
      ? `not for any other ${buckets[0]}`
      : `not for other ${or(buckets)} values`;
  return `only for visitors ${clauses.join(" and ")} (${others})`;
}

type FieldRef = { path: string; trust: Trust };
/** A field written by the site owner. */
export const owner = (path: string): FieldRef => ({ path, trust: "owner" });
/** A field computed by the site's own systems (counts, statuses). */
export const system = (path: string): FieldRef => ({ path, trust: "system" });
/** A field written by someone else (reviews, social posts); never reaches a decider. */
export const thirdParty = (path: string): FieldRef => ({ path, trust: "third-party" });

type DefaultInput = DataSourceManifestInput["default"];
export type SourceInput<T = unknown> = Omit<
  DataSourceManifestInput,
  "access" | "freshness" | "tags" | "heuristics" | "fields" | "default" | "fetch"
> &
  Partial<
    Pick<DataSourceManifestInput, "access" | "freshness" | "tags" | "heuristics" | "fields">
  > & {
    default?: Partial<DefaultInput>;
    fetch: (ctx: FetchContext) => Promise<T>;
  };

const DEFAULT_PLACEMENT: DefaultInput = {
  include: true,
  salience: "standard" satisfies Salience,
  region: "primary",
  prominence: 1,
};

/**
 * Declare a data source with defaults: public, static, no tags or heuristics, included in the
 * primary region at standard salience. Trust has no default: every field says whose it is.
 */
export function defineSource<T>(input: SourceInput<T>): DataSourceManifestInput {
  return {
    access: "public",
    freshness: "static",
    tags: [],
    heuristics: [],
    fields: {},
    ...input,
    default: { ...DEFAULT_PLACEMENT, ...input.default },
  } as DataSourceManifestInput;
}
