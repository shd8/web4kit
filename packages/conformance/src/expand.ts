import type { ContextEnvelope } from "@web4kit/context";
import type { Fixture, Invariant } from "./fixtures";

export interface Variant {
  label: string;
  apply: (envelope: ContextEnvelope) => ContextEnvelope;
}
export interface Axis {
  name: string;
  variants: Variant[];
}

/**
 * Combinatorial fixture expansion over envelope variations (which drive bucket values).
 * The full cross product is sampled deterministically down to `limit` fixtures.
 */
export function expandFixtures(config: {
  base: ContextEnvelope;
  axes: Axis[];
  limit?: number;
  invariants?: (envelope: ContextEnvelope) => Invariant[];
  seed?: number;
}): Fixture[] {
  let combos: Array<{ names: string[]; envelope: ContextEnvelope }> = [
    { names: [], envelope: config.base },
  ];
  for (const axis of config.axes) {
    combos = combos.flatMap((c) =>
      axis.variants.map((v) => ({
        names: [...c.names, `${axis.name}=${v.label}`],
        envelope: v.apply(structuredClone(c.envelope)),
      })),
    );
  }
  const limit = config.limit ?? combos.length;
  const sampled = limit >= combos.length ? combos : sample(combos, limit, config.seed ?? 7);
  return sampled.map((c) => ({
    name: c.names.join(","),
    envelope: c.envelope,
    invariants: config.invariants?.(c.envelope) ?? [],
  }));
}

/** Deterministic sample without replacement (xorshift). */
function sample<T>(items: T[], n: number, seed: number): T[] {
  const copy = [...items];
  let s = seed >>> 0 || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}
