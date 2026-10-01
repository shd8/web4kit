import type { RequestLike } from "@web4kit/context";
import { createSiteCore, type Site, type SiteConfig, type SitePage } from "./site";

export * from "./calibration-check";
export * from "./preview-bar";
export * from "./site";

type SearchParams = Record<string, string | string[] | undefined>;

export interface NextSite extends Site {
  /**
   * Plan the page for the current request from a server component:
   * `const page = await site.page({ searchParams })`.
   */
  page(props: {
    searchParams?: SearchParams | Promise<SearchParams>;
    /** Path of the page (server components do not know it). Default `/`. */
    path?: string;
  }): Promise<SitePage>;
}

/** Create a web4 site for Next.js (App Router, server components). */
export function createSite(config: SiteConfig): NextSite {
  const core = createSiteCore(config);
  return Object.assign(core, {
    async page(props: Parameters<NextSite["page"]>[0] = {}) {
      const { headers } = await import("next/headers");
      const h = await headers();
      return core.handle(requestFrom(h, await props.searchParams, props.path));
    },
  });
}

/** Build a RequestLike from Next.js headers and search params. */
export function requestFrom(
  headers: Headers,
  searchParams: SearchParams | undefined,
  path = "/",
): RequestLike {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (typeof v === "string") query.append(k, v);
    else if (Array.isArray(v)) for (const item of v) query.append(k, item);
  }
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const qs = query.toString();
  return { url: `http://${host}${path}${qs ? `?${qs}` : ""}`, headers };
}

export type { SiteConfig, SitePage };
