/**
 * Engine-independent confidence (design D2).
 * choice/score: (n * pmax - 1) / (n - 1)   -- 0 when uniform, 1 when all mass on one option
 * noul:         |2p - 1|                   -- 0 at p = 0.5, 1 at p = 0 or 1
 */
export function distributionConfidence(probabilities: Record<string, number>): number {
  const values = normalize(Object.values(probabilities));
  const n = values.length;
  if (n <= 1) return 1;
  const pmax = Math.max(...values);
  return clamp01((n * pmax - 1) / (n - 1));
}

export function noulConfidence(p: number): number {
  return clamp01(Math.abs(2 * p - 1));
}

export function normalize(values: number[]): number[] {
  const sum = values.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);
  if (sum <= 0) return values.map(() => 1 / Math.max(values.length, 1));
  return values.map((v) => (Number.isFinite(v) && v > 0 ? v / sum : 0));
}

export function normalizeRecord(probabilities: Record<string, number>): Record<string, number> {
  const keys = Object.keys(probabilities);
  const values = normalize(keys.map((k) => probabilities[k] ?? 0));
  return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? 0]));
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}
