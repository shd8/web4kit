# @web4kit/next

web4 for Next.js (App Router). One call from a server component resolves the visitor's context, derives the situation, plans the page (one System One round or a plan-cache hit), and fetches the data with the planned situation. Development-only persona previews come built in.

Part of [web4](https://github.com/shd8/web4kit): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/next
```

## Usage

```ts
// web4/site.ts (server only)
import { createSite } from "@web4kit/next";

export const site = createSite({
  manifests,
  situation: RULES,           // SituationRule[] or (envelope) => situation
  decider,                    // optional: rules when omitted
  calibration,                // optional profile
  personas: PERSONAS,         // ?as=<name> previews, development only
  enrich: async (env, req) => env, // first-party facts for real requests
});
```

```tsx
// app/page.tsx
import { PreviewBar } from "@web4kit/next";
import { defaultRegistry, PlanView } from "@web4kit/react";
import { site } from "@/web4/site";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const page = await site.page({ searchParams });
  return (
    <>
      <PreviewBar site={site} page={page} statsHref="/stats" />
      <PlanView plan={page.plan} data={page.data} manifests={site.manifests} registry={defaultRegistry} />
    </>
  );
}
```

`PreviewBar` renders only when previews are on. Besides the persona links, it shows a notice when the page was planned by the rules engine alone (no decider configured) or by an engine whose calibration profile is missing or stale, since every answer then falls back to rules.

`site.handle({ url, headers })` is the framework-agnostic entry, and `site.stats()` returns the planner's counters (pages, cache hits, tokens, cost, calibration status).

Order of operations: persona preview (only when previews are on; off in production by default) → context → `enrich` (real requests only) → situation → plan → data.

## License

MIT
