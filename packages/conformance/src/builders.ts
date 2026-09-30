import type { ContextEnvelope, Situation } from "@web4kit/context";
import type { Region } from "@web4kit/ir";
import {
  type Condition,
  type ManifestSet,
  PROMINENCE_LEVELS,
  SALIENCE_LEVELS,
  type Salience,
} from "@web4kit/manifest";
import { KINDS, matches } from "@web4kit/planner";
import { type Axis, expandFixtures } from "./expand";
import type { ExpectedAnswer, Fixture, Invariant, SituatedFixture } from "./fixtures";

type Prominence = (typeof PROMINENCE_LEVELS)[number] | 0 | 1 | 2;
const level = (levels: readonly string[], v: string | number) =>
  typeof v === "number" ? v : levels.indexOf(v);

/** Expected answers written with names instead of question kinds and level indices. */
export const label = {
  relevant: (source: string, value = true): ExpectedAnswer => ({
    kind: KINDS.relevance,
    source,
    accept: [value],
  }),
  salience: (source: string, ...levels: Salience[]): ExpectedAnswer => ({
    kind: KINDS.salience,
    source,
    accept: levels.map((l) => level(SALIENCE_LEVELS, l)),
  }),
  component: (source: string, ...ids: string[]): ExpectedAnswer => ({
    kind: KINDS.component,
    source,
    accept: ids,
  }),
  region: (source: string, ...regions: Region[]): ExpectedAnswer => ({
    kind: KINDS.region,
    source,
    accept: regions,
  }),
  prominence: (source: string, ...levels: Prominence[]): ExpectedAnswer => ({
    kind: KINDS.prominence,
    source,
    accept: levels.map((l) => level(PROMINENCE_LEVELS, l)),
  }),
};

type Maybe<T> = T | false | null | undefined | 0 | "";
const truthy = <T>(items: Array<Maybe<T>>): T[] => items.filter(Boolean) as T[];

/** Labels as a function of the situation; write conditional entries as `cond && label...`. */
export const labelsFrom =
  (fn: (s: Situation) => Array<Maybe<ExpectedAnswer>>) =>
  (s: Situation): ExpectedAnswer[] =>
    truthy(fn(s));

/** Invariants as a function of the situation, with the same conditional style. */
export const invariantsFrom =
  (fn: (s: Situation) => Array<Maybe<Invariant>>) =>
  (s: Situation): Invariant[] =>
    truthy(fn(s));

export const invariant = {
  present: (source: string): Invariant => ({ type: "present", source }),
  absent: (source: string): Invariant => ({ type: "absent", source }),
  hero: (...sources: string[]): Invariant => ({ type: "hero", sources }),
  component: (source: string, ...ids: string[]): Invariant => ({
    type: "component",
    source,
    in: ids,
  }),
  region: (source: string, ...regions: Region[]): Invariant => ({
    type: "region",
    source,
    in: regions,
  }),
  above: (source: string, below: string): Invariant => ({ type: "above", source, below }),
};

export type EnvelopePatch = Partial<ContextEnvelope> | ((e: ContextEnvelope) => ContextEnvelope);

/**
 * Fixture grid over named envelope variations: the full cross product of every axis, sampled
 * deterministically to `limit`. Fixtures are named `axis=label,axis=label`.
 */
export function grid(config: {
  base: ContextEnvelope;
  axes: Record<string, Record<string, EnvelopePatch>>;
  limit?: number;
  seed?: number;
}): Fixture[] {
  const axes: Axis[] = Object.entries(config.axes).map(([name, variants]) => ({
    name,
    variants: Object.entries(variants).map(([labelName, patch]) => ({
      label: labelName,
      apply: (e) => (typeof patch === "function" ? patch(e) : { ...e, ...patch }),
    })),
  }));
  return expandFixtures({
    base: config.base,
    axes,
    ...(config.limit !== undefined ? { limit: config.limit } : {}),
    ...(config.seed !== undefined ? { seed: config.seed } : {}),
  });
}

/** `mustInclude` / `mustExclude` of every source, as the invariants they imply. */
export function manifestInvariants(manifests: ManifestSet, situation: Situation): Invariant[] {
  const out: Invariant[] = [];
  const holds = (c: Condition | undefined) => c !== undefined && matches(c, situation);
  for (const s of manifests.sources) {
    if (holds(s.mustExclude)) out.push(invariant.absent(s.id));
    else if (holds(s.mustInclude)) out.push(invariant.present(s.id));
  }
  return out;
}

/**
 * Derive each fixture's situation and append the invariants and labels that follow from it:
 * manifest invariants, site-wide invariants and labels. Existing entries are kept.
 */
export function situate(
  fixtures: Fixture[],
  options: {
    situationOf: (envelope: ContextEnvelope) => Situation;
    manifests?: ManifestSet;
    invariants?: (s: Situation) => Invariant[];
    labels?: (s: Situation) => ExpectedAnswer[];
  },
): SituatedFixture[] {
  return fixtures.map((f) => {
    const situation = options.situationOf(f.envelope);
    return {
      ...f,
      situation,
      invariants: dedupe([
        ...f.invariants,
        ...(options.manifests ? manifestInvariants(options.manifests, situation) : []),
        ...(options.invariants?.(situation) ?? []),
      ]),
      expected: [...(f.expected ?? []), ...(options.labels?.(situation) ?? [])],
    };
  });
}

function dedupe(invariants: Invariant[]): Invariant[] {
  const seen = new Set<string>();
  return invariants.filter((i) => {
    const key = JSON.stringify(i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
