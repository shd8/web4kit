import type { Block, Device, Footprint, Region, Why } from "@web4kit/ir";
import { REGIONS } from "@web4kit/ir";

/** A source that survived Stage A, with its Stage B/C decisions, ready for layout. */
export interface Candidate {
  sourceId: string;
  componentId: string;
  propsBinding: Record<string, string>;
  region: Region;
  /** Expected prominence level (0..2). */
  prominence: number;
  /** Expected salience level (0..3). */
  salience: number;
  /** Manifest default order; lower first. */
  defaultRank: number;
  footprint: Record<Device, Footprint>;
  mediaHeavy: boolean;
  /** Replacement when the media budget is low. */
  fallback?: { componentId: string; footprint: Record<Device, Footprint> };
  why: Why[];
}

export type Capacities = Record<Region, number>;

export const DEFAULT_CAPACITIES: Capacities = {
  hero: 1,
  primary: 4,
  secondary: 4,
  aside: 3,
  footer: 6,
};

/** Where a block goes when its region is full. */
const OVERFLOW: Record<Region, Region | undefined> = {
  hero: "primary",
  primary: "secondary",
  aside: "secondary",
  secondary: "footer",
  footer: undefined,
};

export interface SolveInput {
  candidates: Candidate[];
  device: Device;
  /** Seed derived from the situation hash; breaks ties deterministically. */
  seed: string;
  mediaBudget: "high" | "low" | "unknown";
  capacities?: Partial<Capacities>;
}

export interface SolveResult {
  layout: Record<Region, Block[]>;
  /** Candidates dropped because every region down the overflow chain was full. */
  dropped: Array<{ sourceId: string; why: Why[] }>;
}

/**
 * Deterministic layout solver (design D7): region filling with capacities and overflow
 * demotion, structural invariants, per-device footprints, seeded tie-breaking.
 */
export function solve(input: SolveInput): SolveResult {
  const capacities = { ...DEFAULT_CAPACITIES, ...input.capacities };
  const layout = Object.fromEntries(REGIONS.map((r) => [r, [] as Block[]])) as Record<
    Region,
    Block[]
  >;
  const dropped: SolveResult["dropped"] = [];

  // Invariant: every source is rendered by exactly one component.
  const unique = new Map<string, Candidate>();
  for (const c of input.candidates) if (!unique.has(c.sourceId)) unique.set(c.sourceId, c);

  const candidates = [...unique.values()].map((c) => applyMediaBudget(c, input.mediaBudget));
  const sorted = candidates.sort((a, b) => compare(a, b, input.seed));

  for (const candidate of sorted) {
    let region: Region | undefined = candidate.region;
    // Aside exists only on desktop; elsewhere it merges into secondary.
    if (region === "aside" && input.device !== "desktop") {
      candidate.why.push(
        invariant(
          "invariant.aside-desktop-only",
          "secondary",
          `aside merged into secondary on ${input.device}`,
        ),
      );
      region = "secondary";
    }
    const wanted = region;
    while (region && layout[region].length >= capacities[region]) region = OVERFLOW[region];
    if (!region) {
      candidate.why.push(
        invariant("invariant.capacity", null, `no capacity left from ${wanted} down`),
      );
      dropped.push({ sourceId: candidate.sourceId, why: candidate.why });
      continue;
    }
    if (region !== wanted) {
      candidate.why.push(
        invariant(`invariant.${wanted}-capacity`, region, `${wanted} full; demoted to ${region}`),
      );
    }
    layout[region].push(toBlock(candidate, input.device, region));
  }
  return { layout, dropped };
}

function applyMediaBudget(c: Candidate, budget: SolveInput["mediaBudget"]): Candidate {
  if (budget !== "low" || !c.mediaHeavy || !c.fallback) return { ...c, why: [...c.why] };
  return {
    ...c,
    componentId: c.fallback.componentId,
    footprint: c.fallback.footprint,
    mediaHeavy: false,
    why: [
      ...c.why,
      invariant(
        "invariant.media-budget",
        c.fallback.componentId,
        `media budget low; replaced ${c.componentId}`,
      ),
    ],
  };
}

function compare(a: Candidate, b: Candidate, seed: string): number {
  return (
    b.prominence - a.prominence ||
    b.salience - a.salience ||
    a.defaultRank - b.defaultRank ||
    tieBreak(seed, a.sourceId) - tieBreak(seed, b.sourceId) ||
    a.sourceId.localeCompare(b.sourceId)
  );
}

/** FNV-1a over seed + id: stable pseudo-random order per situation. */
export function tieBreak(seed: string, id: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${seed}:${id}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function toBlock(c: Candidate, device: Device, region: Region): Block {
  return {
    sourceId: c.sourceId,
    componentId: c.componentId,
    propsBinding: c.propsBinding,
    footprint: gridFootprint(c.footprint[device], device, region),
    prominence: c.prominence,
    why: c.why,
  };
}

/**
 * Per-device grid templates: mobile is a single column; hero and footer always span the width;
 * other regions honour the declared footprint within a 12-column grid.
 */
export function gridFootprint(declared: Footprint, device: Device, region: Region): Footprint {
  if (device === "mobile" || region === "hero" || region === "footer") {
    return { colSpan: 12, rowSpan: declared.rowSpan };
  }
  return { colSpan: Math.min(12, Math.max(1, declared.colSpan)), rowSpan: declared.rowSpan };
}

function invariant(question: string, answer: string | null, note: string): Why {
  return { question, answer, decidedBy: "invariant", note };
}
