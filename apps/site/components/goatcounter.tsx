"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string }) => void };
  }
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The page path without the base path, as the site's own routes name it: `/playground/`. */
export function pagePath(pathname: string, base = basePath): string {
  const path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return path || "/";
}

let counted: string | undefined;
/** Count the current page once; GoatCounter reads `?ref=` from the URL itself. */
function count() {
  const path = pagePath(window.location.pathname);
  if (path === counted || !window.goatcounter?.count) return;
  counted = path;
  window.goatcounter.count({ path });
}

/**
 * Cookie-free page views (GoatCounter). Its automatic count on load is off: the static export
 * navigates client-side, so each route change is counted here, without the base path.
 */
export function GoatCounter({ code }: { code: string }) {
  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: count again whenever the route changes
  useEffect(count, [pathname]);
  return (
    <Script
      src="https://gc.zgo.at/count.js"
      strategy="afterInteractive"
      data-goatcounter={`https://${code}.goatcounter.com/count`}
      data-goatcounter-settings='{"no_onload": true}'
      onLoad={count}
    />
  );
}
