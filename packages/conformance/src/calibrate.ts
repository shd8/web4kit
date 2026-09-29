import type { CalibrationEntry } from "@web4kit/planner";

export interface Observation {
  kind: string;
  language: string;
  confidence: number;
  correct: boolean;
}

export interface CalibrateOptions {
  /** Minimum labelled samples for an entry to be emitted. */
  minSamples: number;
  /** Maximum error rate tolerated among accepted answers (article: 5% accepted-case error). */
  maxAcceptedError: number;
  /** Minimum share of answers that must be accepted for a threshold to be useful. */
  minCoverage: number;
  /** Flip rate above which a safety margin is added to the threshold. */
  maxFlipRate: number;
  margin: number;
}

export const DEFAULT_CALIBRATE: CalibrateOptions = {
  minSamples: 30,
  maxAcceptedError: 0.05,
  minCoverage: 0.1,
  maxFlipRate: 0.05,
  margin: 0.05,
};

/**
 * Overlap-based threshold (design D3/D12): the lowest confidence above which incorrect answers
 * stop meaningfully overlapping correct ones, i.e. the accepted error rate is within bounds.
 * When no such threshold keeps enough coverage, the combination is uncalibrated: failure
 * confidence overlaps success confidence (silent failure) and the planner must fall back.
 */
export function calibrateEntry(
  observations: Observation[],
  flipRate: number | undefined,
  options: CalibrateOptions = DEFAULT_CALIBRATE,
): CalibrationEntry | undefined {
  const n = observations.length;
  if (n < options.minSamples) return undefined;
  const correct = observations.filter((o) => o.correct);
  const accuracy = correct.length / n;
  const incorrect = observations.filter((o) => !o.correct);
  const medianCorrect = median(correct.map((o) => o.confidence));
  const overlap =
    incorrect.length === 0
      ? 0
      : incorrect.filter((o) => o.confidence >= medianCorrect).length / incorrect.length;

  const candidates = [...new Set(observations.map((o) => o.confidence))].sort((a, b) => a - b);
  let threshold: number | undefined;
  for (const t of candidates) {
    const accepted = observations.filter((o) => o.confidence >= t);
    const errors = accepted.filter((o) => !o.correct).length;
    if (accepted.length / n < options.minCoverage) break;
    if (errors / accepted.length <= options.maxAcceptedError) {
      threshold = t;
      break;
    }
  }
  const base = {
    accuracy,
    overlap,
    sampleSize: n,
    ...(flipRate !== undefined ? { flipRate } : {}),
  };
  if (threshold === undefined) return { ...base, acceptThreshold: 1, uncalibrated: true };
  if (flipRate !== undefined && flipRate > options.maxFlipRate)
    threshold = Math.min(1, threshold + options.margin);
  return { ...base, acceptThreshold: round(threshold), uncalibrated: false };
}

function median(values: number[]): number {
  if (values.length === 0) return 1;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const round = (x: number) => Math.round(x * 1000) / 1000;
