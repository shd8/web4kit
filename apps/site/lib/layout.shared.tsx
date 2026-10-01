import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { GITHUB_URL } from "./links";
import { sitePages } from "./source";

/** Site-only pages in navigation order; only those whose content exists are linked. */
const PAGE_ORDER = ["concepts", "sources-and-audience", "thesis"];

export function siteLinks() {
  const pages = sitePages
    .getPages()
    .sort((a, b) => PAGE_ORDER.indexOf(a.slugs[0]!) - PAGE_ORDER.indexOf(b.slugs[0]!));
  return [
    { text: "Playground", url: "/playground" },
    { text: "Docs", url: "/docs/getting-started" },
    ...pages.map((p) => ({ text: p.data.title, url: p.url })),
  ];
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "web4kit" },
    githubUrl: GITHUB_URL,
    links: siteLinks(),
  };
}
