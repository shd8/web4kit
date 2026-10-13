import { defineSource, type SourceInput } from "./authoring";
import type { Condition, DataSourceManifestInput } from "./schema";
import { ManifestError } from "./validate";

/** A site's situation buckets: bucket -> its closed set of labels (empty means open). */
export type Buckets = Readonly<Record<string, readonly string[]>>;

/** A situation condition whose bucket names and labels are checked against the site's buckets. */
export type ConditionFor<B extends Buckets> = {
  [K in keyof B & string]?: (B[K][number] | "unknown")[];
};

type HeuristicInput = NonNullable<DataSourceManifestInput["heuristics"]>[number];

export type SourceInputFor<B extends Buckets, T = unknown> = Omit<
  SourceInput<T>,
  "audience" | "mustInclude" | "mustExclude" | "heuristics"
> & {
  audience?: ConditionFor<B>;
  mustInclude?: "always" | ConditionFor<B>;
  mustExclude?: ConditionFor<B>;
  heuristics?: (Omit<HeuristicInput, "when"> & { when: ConditionFor<B> })[];
};

/**
 * `defineSource` bound to the site's buckets: `audience`, `mustInclude`, `mustExclude` and
 * heuristic conditions autocomplete, and a misspelt bucket or label is a type error (and, from
 * plain JavaScript, a ManifestError naming the source and the field).
 *
 *   const defineSource = defineSourceFor(BUCKETS);
 */
export function defineSourceFor<const B extends Buckets>(buckets: B) {
  return <T>(input: SourceInputFor<B, T>): DataSourceManifestInput => {
    const conditions: [string, Condition | "always" | undefined][] = [
      ["audience", input.audience as Condition | undefined],
      ["mustInclude", input.mustInclude as Condition | "always" | undefined],
      ["mustExclude", input.mustExclude as Condition | undefined],
      ...(input.heuristics ?? []).map(
        (h, i) => [`heuristics.${i}.when`, h.when as Condition] as [string, Condition],
      ),
    ];
    const issues = conditions.flatMap(([field, c]) =>
      c && c !== "always" ? conditionIssues(input.id, field, c, buckets) : [],
    );
    if (issues.length) throw new ManifestError(issues);
    return defineSource(input as SourceInput<T>);
  };
}

function conditionIssues(id: string, field: string, condition: Condition, buckets: Buckets) {
  const issues: string[] = [];
  for (const [bucket, labels] of Object.entries(condition)) {
    const allowed = buckets[bucket];
    if (!allowed) {
      issues.push(
        `source ${id}: ${field}: unknown bucket "${bucket}" (declared: ${Object.keys(buckets).join(", ")})`,
      );
      continue;
    }
    if (!allowed.length) continue; // open bucket, e.g. language
    for (const label of labels)
      if (label !== "unknown" && !allowed.includes(label))
        issues.push(
          `source ${id}: ${field}.${bucket}: unknown label "${label}" (allowed: ${allowed.join(", ")})`,
        );
  }
  return issues;
}
