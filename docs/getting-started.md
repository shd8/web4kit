# Getting started with web4

This guide builds a small web4 site from scratch, **Rosa Bakery**, and takes it from "one page for everyone" to "a page planned for each visitor". It uses the published `@web4kit/*` packages. Everything here also runs inside this repository.

> web4 is experimental (0.x). APIs can change between minor versions.

## 0. Concepts in one minute

| Term | What it is |
|---|---|
| **Context Envelope** | Signals from the first request: `?src=`, referrer, device, language, local time, CDN geo, a consented visit cookie. |
| **Situation** | The envelope turned into English labels from closed sets (`arrival=visual`, `device=mobile`, …). This is the only thing the decider ever sees. |
| **Manifest** | Your declaration of a data source (shape, owner-written `what`/`not_for`, `audience`, per-field trust, defaults, invariants) or a component. The manifests are the prompt. |
| **Decider** | A System One model (Jev, or a Jev-like model such as Laya) or the offline rules engine. It answers typed questions: `choice`, `score`, `noul`. |
| **Planner** | Asks, in one round, for every source: *relevant? how important? which component? which region? how prominent?* It gates each answer by calibrated confidence, then lays the page out. |
| **Page Plan** | JSON (`web4.plan/v1`) holding decisions only, never user data, so it can be cached per situation. |
| **Renderer** | Fetches data fresh and renders each block fail-soft with the curated components. |

## 1. Install

```bash
pnpm add @web4kit/context @web4kit/manifest @web4kit/planner @web4kit/react react react-dom
# Next.js sites: add @web4kit/next
```

Node ≥ 20. The packages are ESM only.

## 2. Describe your data sources

Every source declares its **shape** (`list`, `record`, `schedule`, `media-list`, `geo`, `timeseries` or `graph`), how its fields map to component roles (`title`, `value`, `image`, …), who wrote each field (`owner` / `system` / `third-party`), and what to do by default.

```ts
import { defineManifests, defineSource, owner } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";

export const manifests = defineManifests({
  site: "rosa-bakery",
  components: libraryManifests, // the curated component library
  sources: [
    defineSource({
      id: "breads",
      shape: "list",
      label: "Today's bread",
      tags: ["bread", "prices"],
      what: "Breads baked this morning, with prices",
      freshness: "daily",
      fields: { title: owner("name"), value: owner("price") },
      default: { salience: "featured", prominence: 2, component: "menu-list" },
      fetch: async () => [
        { name: "Sourdough loaf", price: "€5.50" },
        { name: "Rye & caraway", price: "€4.80" },
      ],
    }),
    defineSource({
      id: "photos",
      shape: "media-list",
      label: "From the oven",
      tags: ["photos"],
      what: "Photos of fresh bread and pastries",
      audience: { mediaBudget: ["high"] },
      freshness: "weekly",
      fields: { image: owner("src"), imageAlt: owner("alt"), title: owner("name") },
      default: { include: false, region: "hero", prominence: 2, component: "hero-carousel" },
      heuristics: [{ when: { arrival: ["visual"] }, relevant: true }],
      fetch: async () => [{ src: "https://example.com/loaf.jpg", alt: "A sourdough loaf", name: "Sourdough" }],
    }),
  ],
});
```

`defineSource` fills the boring parts (public, static, no tags or heuristics, included in the primary region at standard salience). Trust is never defaulted: every field says whose content it is, with `owner()`, `system()` or `thirdParty()`.

Rules of thumb:

- **`what` / `not_for` / `audience` are the prompt.** System One models read literally.
- **Say who a source is for with `audience`, not prose.** `audience: { stayPhase: ["researching"] }` is rendered into every question as "only for visitors whose stayPhase is researching (not for any other stayPhase)", and the rules engine applies the same condition. Hand-written exclusion lists drift; on the hotel starter, moving them to `audience` took relevance from 99.8% to 100%.
- **Business rules are invariants.** `mustInclude` / `mustExclude` are situation conditions the planner enforces whatever the engine answers ("never show room prices to a guest who is already staying"). Exclusion wins if both hold.
- **`heuristics` drive the offline rules engine.** It is your fallback whenever an engine is unavailable or uncalibrated, so make it a sensible page on its own.
- **Mark third-party fields with `thirdParty()`** (reviews, social captions). They are rendered but never sent to a decider.
- Fetchers receive `ctx.situation` (labels only), so a block can adapt its owner-written copy, for example "check-out until 11:00" for a guest who is staying.
- `defineManifests` validates everything and throws with errors that name the source and field.

## 3. Turn requests into a situation

```ts
import { CORE_BUCKETS, CORE_RULES, collectEnvelope, deriveSituation } from "@web4kit/context";

const { envelope } = collectEnvelope({ url: request.url, headers: request.headers });
const situation = deriveSituation(envelope, CORE_RULES);
// { arrival: "visual", device: "mobile", familiarity: "unknown", language: "english", mediaBudget: "high" }
```

`CORE_RULES` derive `arrival`, `device`, `mediaBudget`, `familiarity` and `language`. For physical places, compose what you need:

| Rule | Label |
|---|---|
| `distanceRule({ location })` | `visitor`: nearby / local / tourist |
| `openingHoursRule({ timezone, hours })` | `openState`: open / closing-soon / closed |
| `mealWindowRule({ timezone })` | `mealWindow`: breakfast … late |
| `dayPartRule({ timezone })` | `dayPart`: morning / afternoon / evening / night |

`venueRules({ location, timezone, hours })` is the first three together. You can write your own `SituationRule`: a pure function from envelope to labels. Do all maths there; System One models are weak at numbers and dates.

First-party facts your own systems know (a booking's dates from a confirmation link) go in `envelope.firstParty` through `resolveContext(request, { labMode: false, enrich })`. `enrich` runs for real requests only, never for fixtures.

## 4. Check the portability contract

```ts
import { lintPortability } from "@web4kit/planner";

lintPortability(manifests, CORE_BUCKETS); // throws PortabilityError naming any question that is too big
```

Every question must fit Laya-class System One limits (state < 512 tokens, fewer than 20 options per choice). Then any Jev-like engine can run your site. Run the lint in CI.

## 5. Plan and render

```ts
import { createPlanner, LruPlanCache } from "@web4kit/planner";
import { defaultRegistry, PlanView, resolvePlanData } from "@web4kit/react";

const planner = createPlanner({ manifests, cache: new LruPlanCache() }); // rules engine: offline, free

const { plan, cacheHit, planningMs } = await planner.plan({ situation });
const data = await resolvePlanData(plan, manifests, { now: new Date(), viewer: { roles: [] } });

// In a React Server Component (e.g. a Next.js page):
return (
  <main data-w4-theme="lumbre">
    <PlanView plan={plan} data={data} manifests={manifests} registry={defaultRegistry} />
  </main>
);
```

- **Plans are cached per situation.** They contain no user or fetched data, so every visitor in the same situation shares one plan. A cache hit costs 0 tokens and about 1 ms.
- **Data is resolved at render time**, with `access` checks, so cached plans always show fresh content.
- **Blocks are fail-soft.** A block whose props don't validate falls back to the source's default component, or is omitted. The page never breaks.

### Styles

Wrap the page in `data-w4-theme="lumbre"` (warm, editorial) or `data-w4-theme="ops"` (cool, dense). Then either:

- **Without Tailwind:** `import "@web4kit/react/styles.css";`, the tokens plus every utility the components use.
- **With Tailwind v4:**

  ```css
  @import "tailwindcss";
  @import "@web4kit/react/tailwind.css"; /* tokens + lets Tailwind see the components */
  ```

### Next.js in one call

`@web4kit/next` wires steps 3 to 5 together (context, `enrich`, situation, plan, data with the situation) and adds development-only persona previews:

```ts
// web4/site.ts
import { createSite } from "@web4kit/next";
export const site = createSite({ manifests, situation: RULES, decider, calibration, personas, enrich });
```

```tsx
// app/page.tsx
const page = await site.page({ searchParams });
return (
  <>
    <PreviewBar site={site} page={page} statsHref="/stats" />
    <PlanView plan={page.plan} data={page.data} manifests={site.manifests} registry={defaultRegistry} />
  </>
);
```

`?as=<persona>` works only when previews are on, which is by default outside production. `site.stats()` returns pages, cache hits, tokens, cost and calibration status. `pnpm create web4kit` scaffolds a complete site like this.

## 6. Plan with Jev

```ts
import { createJevDecider, jevConfigFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";

loadDotEnv(); // reads JEV_API_KEY from .env
const jev = jevConfigFromEnv();
const planner = createPlanner({
  manifests,
  cache: new LruPlanCache(),
  ...(jev ? { decider: createJevDecider(jev) } : {}),
  calibration, // see step 7
});
```

- **One round per page.** The planner sends every stage question for every source in one logical round. Requests that exceed an engine's limits are split into parallel requests. On the Casa Lumbre example that's about 6.7k input tokens, **≈ $0.0003 per uncached page**, with p50 ≈ 280 ms.
- **Failures fall back to rules.** If Jev fails, times out or is rate-limited, those questions are answered by rules, and the reason is recorded in each block's `why`.
- **No calibration, no trust.** Without a calibration profile, every Jev answer is gated to rules ("uncalibrated"). That is deliberate: an unmeasured engine is never trusted.

Other engines behind the same `Decider` interface: `createSystemOneHttpDecider` (any `/v1/systemone` endpoint, e.g. Ollaya serving Laya), `@web4kit/decider-laya` (in-process ONNX), and `createCascadeDecider` (a cheap engine first, escalating to Jev on low confidence).

## 7. Calibrate with the conformance suite

Write persona fixtures (envelopes), a grid of variations, the page properties that must hold, and hand-labelled answers you're sure about. Then measure an engine:

```ts
import { grid, invariant, invariantsFrom, label, labelsFrom, runEngine, situate } from "@web4kit/conformance";

const fixtures = situate([...PERSONAS, ...grid({ base, axes: { arrival: { insta: { src: "instagram" }, direct: {} }, device: { mobile: {}, desktop: { device: "desktop" } } } })], {
  situationOf,
  manifests, // mustInclude / mustExclude become invariants automatically
  invariants: invariantsFrom((s) => [s.mediaBudget === "low" && invariant.absent("photos")]),
  labels: labelsFrom((s) => [s.arrival === "visual" && label.relevant("photos")]),
});
const run = await runEngine({ manifests, fixtures, decider: createJevDecider(jev!), repeats: 3 });

console.log(run.invariantPassRate, run.byKind);          // accuracy and confidence on failures, per question kind
writeFileSync("calibration/jev-1.13.0.json", JSON.stringify(run.profile, null, 2));
```

Load it with `loadCalibration("calibration", decider.id)` from `@web4kit/planner/node` and pass it as `calibration`. For each question kind and language, the profile holds the threshold above which the engine's answers are trusted. Combinations where the engine is as confident on wrong answers as on right ones are marked **uncalibrated** and answered by rules. That's how web4 catches silent failures.

A profile is tied to what the decider can see (`manifests.deciderVersion`: descriptions, audience, tags, shapes, components). Editing a heading, a heuristic or a default keeps it valid. Editing the prompt makes it **stale**: the planner ignores it (every answer falls back to rules) and reports `planner.calibrationStatus.status === "stale"` until you re-run calibration.

Iterate like a designer: when an invariant fails, sharpen the `what` / `audience` wording, re-run, and watch the numbers.

## 8. Go further

- Read `examples/restaurant` (Casa Lumbre) and `examples/db-explorer` (Meridian Supply) for complete sites with fixtures, labels and invariants.
- Run the lab (`cd apps/lab && W4_LAB_MODE=1 pnpm dev`) to see every decision in the Why panel.
- JSON Schemas for the Page Plan and decider types are in [`schemas/`](../schemas). Other languages can implement parts of web4 against them.
