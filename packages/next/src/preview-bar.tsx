import type { CalibrationStatus } from "@web4kit/planner";
import type { ReactElement } from "react";
import type { Site, SitePage } from "./site";

const chip = "rounded-full px-2.5 py-1 no-underline";
const active = "bg-primary text-primary-foreground";
const idle = "bg-card text-foreground";

/**
 * Why the page isn't planned by a calibrated model, if it isn't. The rules engine is the right
 * fallback, but it only replays hand-written heuristics: say so rather than let it pass for web4.
 */
export function engineNotice(engine: string, calibration: CalibrationStatus): string | undefined {
  if (engine === "rules")
    return "Planned by the rules engine: your hand-written heuristics, not a model. Set JEV_API_KEY or W4_ENGINE=laya in .env to have a System One model plan this page.";
  if (calibration.status === "none")
    return `${engine} has no calibration profile, so every answer falls back to rules. Measure it with pnpm calibrate.`;
  if (calibration.status === "stale")
    return `${engine}'s calibration is stale (${calibration.reason}), so every answer falls back to rules. Re-run pnpm calibrate.`;
  return undefined;
}

/**
 * Development bar: persona preview links plus engine and cache status, and a notice when the
 * page is planned by rules alone. Renders nothing when previews are disabled (production by
 * default). Plain links, so each preview is a fresh server render.
 */
export function PreviewBar({
  site,
  page,
  path = "/",
  statsHref,
}: {
  site: Pick<Site, "personas" | "previews" | "previewParam"> & {
    planner: Pick<Site["planner"], "calibrationStatus">;
  };
  page: Pick<SitePage, "persona" | "plan" | "cacheHit" | "planningMs">;
  path?: string;
  statsHref?: string;
}): ReactElement | null {
  if (!site.previews) return null;
  const notice = engineNotice(page.plan.engine, site.planner.calibrationStatus);
  return (
    <nav
      data-w4-preview-bar=""
      className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-xs"
    >
      <span className="font-semibold uppercase tracking-wider text-muted-foreground">
        Preview as
      </span>
      <a href={path} className={`${chip} ${page.persona ? idle : active}`}>
        Your real request
      </a>
      {site.personas.map((p) => (
        <a
          key={p.name}
          href={`${path}?${site.previewParam}=${encodeURIComponent(p.name)}`}
          className={`${chip} ${page.persona === p.name ? active : idle}`}
        >
          {p.title ?? p.name}
        </a>
      ))}
      <span className="ml-auto font-mono text-muted-foreground">
        {page.plan.engine} ·{" "}
        {page.cacheHit ? "plan cache hit" : `planned in ${Math.round(page.planningMs)} ms`}
        {statsHref ? (
          <>
            {" · "}
            <a href={statsHref} className="underline">
              stats
            </a>
          </>
        ) : null}
      </span>
      {notice ? (
        <p data-w4-engine-notice="" className="basis-full text-foreground">
          {notice}
        </p>
      ) : null}
    </nav>
  );
}
