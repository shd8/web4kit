import { z } from "zod";

export const CalibrationEntrySchema = z.object({
  acceptThreshold: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  /** Share of incorrect answers whose confidence reaches the lowest correct confidence band. */
  overlap: z.number().min(0).max(1),
  sampleSize: z.number().int().nonnegative(),
  /** Share of gated decisions that flip between repeats (non-deterministic engines). */
  flipRate: z.number().min(0).max(1).optional(),
  uncalibrated: z.boolean().default(false),
});
export type CalibrationEntry = z.infer<typeof CalibrationEntrySchema>;

export const CalibrationProfileSchema = z.object({
  engine: z.string(),
  version: z.string(),
  manifestVersion: z.string(),
  /**
   * Decider version of each source when measured. A source whose current version differs is
   * stale; the rest keep using the profile. Absent in v1 profiles (matched per site).
   */
  sourceVersions: z.record(z.string(), z.string()).optional(),
  createdAt: z.string(),
  /** Keyed by `${questionKind}|${language}`. */
  entries: z.record(z.string(), CalibrationEntrySchema),
});
export type CalibrationProfile = z.infer<typeof CalibrationProfileSchema>;

export const calibrationKey = (kind: string, language: string) => `${kind}|${language}`;

/** Look up the threshold for a decision. Missing or uncalibrated entries return undefined. */
export function acceptThreshold(
  profile: CalibrationProfile | undefined,
  kind: string,
  language: string,
): number | undefined {
  const entry = profile?.entries[calibrationKey(kind, language)];
  if (!entry || entry.uncalibrated) return undefined;
  return entry.acceptThreshold;
}

export function isCalibrated(
  profile: CalibrationProfile | undefined,
  kind: string,
  language: string,
) {
  return acceptThreshold(profile, kind, language) !== undefined;
}
