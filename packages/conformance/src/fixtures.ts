import type { ContextEnvelope, Situation } from "@web4kit/context";
import { allBlocks, type Plan, REGIONS, type Region } from "@web4kit/ir";

/** A page-level property every plan for a fixture must satisfy. */
export type Invariant =
  | { type: "present"; source: string }
  | { type: "absent"; source: string }
  | { type: "hero"; sources: string[] }
  | { type: "component"; source: string; in: string[] }
  | { type: "region"; source: string; in: Region[] }
  | { type: "above"; source: string; below: string };

/** Expected answer for one question kind about one source (hand-labelled). */
export interface ExpectedAnswer {
  kind: string;
  source: string;
  /** Accepted values: labels for choices, booleans for nouls, level indices for scores. */
  accept: Array<string | number | boolean>;
}

export interface Fixture {
  name: string;
  /** Short human description shown in lab presets. */
  title?: string;
  envelope: ContextEnvelope;
  /** Typed first-party question (explorer), if any. */
  intent?: { text: string; language: string };
  invariants: Invariant[];
  expected?: ExpectedAnswer[];
}

/** A fixture after situation derivation (what the suite actually plans). */
export interface SituatedFixture extends Fixture {
  situation: Situation;
}

export interface InvariantResult {
  invariant: Invariant;
  ok: boolean;
  detail: string;
}

export function checkInvariants(plan: Plan, invariants: Invariant[]): InvariantResult[] {
  const blocks = allBlocks(plan);
  const regionOf = new Map<string, Region>();
  const indexOf = new Map<string, number>();
  let i = 0;
  for (const region of REGIONS) {
    for (const b of plan.layout[region]) {
      regionOf.set(b.sourceId, region);
      indexOf.set(b.sourceId, i++);
    }
  }
  const byId = new Map(blocks.map((b) => [b.sourceId, b]));
  return invariants.map((inv): InvariantResult => {
    switch (inv.type) {
      case "present":
        return result(
          inv,
          byId.has(inv.source),
          `${inv.source} ${byId.has(inv.source) ? "present" : "missing"}`,
        );
      case "absent":
        return result(
          inv,
          !byId.has(inv.source),
          `${inv.source} ${byId.has(inv.source) ? `present in ${regionOf.get(inv.source)}` : "absent"}`,
        );
      case "hero": {
        const hero = plan.layout.hero[0]?.sourceId;
        return result(inv, !!hero && inv.sources.includes(hero), `hero is ${hero ?? "empty"}`);
      }
      case "component": {
        const c = byId.get(inv.source)?.componentId;
        return result(inv, !!c && inv.in.includes(c), `${inv.source} uses ${c ?? "nothing"}`);
      }
      case "region": {
        const r = regionOf.get(inv.source);
        return result(inv, !!r && inv.in.includes(r), `${inv.source} in ${r ?? "nowhere"}`);
      }
      case "above": {
        const a = indexOf.get(inv.source);
        const b = indexOf.get(inv.below);
        const ok = a !== undefined && (b === undefined || a < b);
        return result(inv, ok, `${inv.source}@${a ?? "-"} vs ${inv.below}@${b ?? "-"}`);
      }
      default:
        return result(inv, false, "unknown invariant");
    }
  });
}

function result(invariant: Invariant, ok: boolean, detail: string): InvariantResult {
  return { invariant, ok, detail };
}

export function describeInvariant(inv: Invariant): string {
  switch (inv.type) {
    case "present":
      return `${inv.source} is shown`;
    case "absent":
      return `${inv.source} is not shown`;
    case "hero":
      return `hero is one of ${inv.sources.join(", ")}`;
    case "component":
      return `${inv.source} uses ${inv.in.join(" or ")}`;
    case "region":
      return `${inv.source} is in ${inv.in.join(" or ")}`;
    case "above":
      return `${inv.source} is above ${inv.below}`;
  }
}
