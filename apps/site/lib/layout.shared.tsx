import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/logo";
import { GITHUB_URL } from "./links";
import { sitePages } from "./source";

/** Site-only pages in navigation order; only those whose content exists are linked. */
const PAGE_ORDER = ["concepts", "sources-and-audience", "thesis", "bench", "faq"];
/** Short navigation labels where the page title is long. */
const NAV_LABEL: Record<string, string> = { thesis: "Thesis" };

export function siteLinks() {
  const pages = sitePages
    .getPages()
    .sort((a, b) => PAGE_ORDER.indexOf(a.slugs[0]!) - PAGE_ORDER.indexOf(b.slugs[0]!));
  return [
    { text: "Playground", url: "/playground" },
    { text: "Docs", url: "/docs/getting-started" },
    ...pages.map((p) => ({ text: NAV_LABEL[p.slugs[0]!] ?? p.data.title, url: p.url })),
  ];
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Logo className="size-5" />
          web4kit
        </>
      ),
    },
    githubUrl: GITHUB_URL,
    links: siteLinks(),
  };
}
