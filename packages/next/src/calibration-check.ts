import { RULES_ENGINE_ID } from "@web4kit/decider";
import type { Planner } from "@web4kit/planner";

/** The command that brings a profile up to date (starters and examples define it). */
export const CALIBRATE_COMMAND = "pnpm calibrate";

/**
 * Is calibration OK for the configured engine? Shared by the build-time warning, `web4kit
 * check` and the X-ray overlay (design D5). Reads the planner's status: never calls a decider.
 */
export type CalibrationReport =
  | { engineId: string; status: "rules"; ok: true; message: string }
  | {
      engineId: string;
      status: "active" | "partial" | "stale" | "missing";
      ok: boolean;
      staleSources: string[];
      fix: string;
      message: string;
    };

export function calibrationReport(site: {
  planner: Pick<Planner, "engineId" | "calibrationStatus">;
}): CalibrationReport {
  const { engineId, calibrationStatus: c } = site.planner;
  if (engineId === RULES_ENGINE_ID)
    return {
      engineId,
      status: "rules",
      ok: true,
      message: "web4: pages are planned by the rules engine; there is nothing to calibrate.",
    };
  const fix = CALIBRATE_COMMAND;
  switch (c.status) {
    case "active":
      return {
        engineId,
        status: "active",
        ok: true,
        staleSources: [],
        fix,
        message: `web4: ${engineId} calibration is active (${c.version}).`,
      };
    case "partial":
      return {
        engineId,
        status: "partial",
        ok: false,
        staleSources: c.staleSources,
        fix,
        message: `web4: ${engineId} calibration is partial: stale for ${c.staleSources.join(", ")}. ${c.staleSources.length === 1 ? "Its" : "Their"} answers fall back to rules in production. Run ${fix}.`,
      };
    case "stale":
      return {
        engineId,
        status: "stale",
        ok: false,
        staleSources: [],
        fix,
        message: `web4: ${engineId} calibration is stale (${c.reason}): every answer falls back to rules in production. Run ${fix}.`,
      };
    default:
      return {
        engineId,
        status: "missing",
        ok: false,
        staleSources: [],
        fix,
        message: `web4: ${engineId} has no calibration profile (missing): every answer falls back to rules in production. Run ${fix}.`,
      };
  }
}

export type CalibrationCheck = "warn" | "error" | "off";

/** True while `next build` runs (Next evaluates server modules to collect page data). */
const isProductionBuild = () =>
  typeof process !== "undefined" && process.env?.NEXT_PHASE === "phase-production-build";

const warned = new Set<string>();

/** Warn (or fail) during a production build when calibration is not active. */
export function checkCalibrationAtBuild(
  site: { planner: Pick<Planner, "engineId" | "calibrationStatus"> },
  mode: CalibrationCheck = "warn",
  log: (message: string) => void = console.warn,
): CalibrationReport | undefined {
  if (mode === "off" || !isProductionBuild()) return undefined;
  const report = calibrationReport(site);
  if (report.ok) return report;
  const strict = mode === "error" || process.env.W4_STRICT_CALIBRATION === "1";
  if (strict) throw new Error(report.message);
  if (!warned.has(report.message)) {
    warned.add(report.message);
    log(report.message);
  }
  return report;
}
