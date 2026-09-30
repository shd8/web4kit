import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type CalibrationProfile, CalibrationProfileSchema } from "./calibration";

/** File name used for an engine's profile: `<dir>/<engine id, sanitized>.json`. */
export const calibrationFileName = (engineId: string) =>
  `${engineId.replace(/[^a-zA-Z0-9._-]+/g, "_")}.json`;

/**
 * Read and validate a stored calibration profile, or undefined when none exists. Whether it
 * still matches the manifests is checked by the planner (`planner.calibrationStatus`).
 */
export function loadCalibration(dir: string, engineId: string): CalibrationProfile | undefined {
  const file = resolve(dir, calibrationFileName(engineId));
  if (!existsSync(file)) return undefined;
  return CalibrationProfileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}
