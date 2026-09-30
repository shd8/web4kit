import type { ReactElement } from "react";
import type { Site, SitePage } from "./site";

const chip = "rounded-full px-2.5 py-1 no-underline";
const active = "bg-primary text-primary-foreground";
const idle = "bg-card text-foreground";

/**
 * Development bar: persona preview links plus engine and cache status. Renders nothing when
 * previews are disabled (production by default). Plain links, so each preview is a fresh
 * server render.
 */
export function PreviewBar({
  site,
  page,
  path = "/",
  statsHref,
}: {
  site: Pick<Site, "personas" | "previews" | "previewParam">;
  page: Pick<SitePage, "persona" | "plan" | "cacheHit" | "planningMs">;
  path?: string;
  statsHref?: string;
}): ReactElement | null {
  if (!site.previews) return null;
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
    </nav>
  );
}
