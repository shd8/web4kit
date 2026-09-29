# Getting started with web4

This guide builds a small web4 site from scratch, **Rosa Bakery**, and takes it from "one page for everyone" to "a page planned for each visitor". It uses the published `@web4kit/*` packages. Everything here also runs inside this repository.

> web4 is experimental (0.x). APIs can change between minor versions.

## 0. Concepts in one minute

| Term | What it is |
|---|---|
| **Context Envelope** | Signals from the first request: `?src=`, referrer, device, language, local time, CDN geo, a consented visit cookie. |
| **Situation** | The envelope turned into English labels from closed sets (`arrival=visual`, `device=mobile`, …). This is the only thing the decider ever sees. |
| **Manifest** | Your declaration of a data source (shape, owner-written `what`/`not_for`, per-field trust, defaults) or a component. The manifests are the prompt. |
| **Decider** | A System One model (Jev, or a Jev-like model such as Laya) or the offline rules engine. It answers typed questions: `choice`, `score`, `noul`. |
| **Planner** | Asks, in one round, for every source: *relevant? how important? which component? which region? how prominent?* It gates each answer by calibrated confidence, then lays the page out. |
| **Page Plan** | JSON (`web4.plan/v1`) holding decisions only, never user data, so it can be cached per situation. |
| **Renderer** | Fetches data fresh and renders each block fail-soft with the curated components. |

## 1. Install

```bash
npm install @web4kit/context @web4kit/manifest @web4kit/planner @web4kit/react react react-dom
```

Node ≥ 20. The packages are ESM only.

## 2. Describe your data sources

Every source declares its **shape** (`list`, `record`, `schedule`, `media-list`, `geo`, `timeseries` or `graph`), how its fields map to component roles (`title`, `value`, `image`, …), who wrote each field (`owner` / `system` / `third-party`), and what to do by default.

```ts
import { defineManifests } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";

export const manifests = defineManifests({
  site: "rosa-bakery",
  components: libraryManifests, // the curated component library
  sources: [
    {
      id: "breads",
      shape: "list",
      label: "Today's bread",
      tags: ["bread", "prices"],
      what: "Breads baked this morning, with prices",
      freshness: "daily",
      access: "public",
      fields: {
        title: { path: "name", trust: "owner" },
        value: { path: "price", trust: "owner" },
      },
      default: { include: true, salience: "featured", region: "primary", prominence: 2, component: "menu-list" },
      heuristics: [],
      fetch: async () => [
        { name: "Sourdough loaf", price: "€5.50" },
        { name: "Rye & caraway", price: "€4.80" },
      ],
    },
    {
      id: "photos",
      shape: "media-list",
      label: "From the oven",
      tags: ["photos"],
      what: "Photos of fresh bread and pastries",
      not_for: "Visitors with mediaBudget low",
      freshness: "weekly",
      access: "public",
      fields: {
        image: { path: "src", trust: "owner" },
        imageAlt: { path: "alt", trust: "owner" },
        title: { path: "name", trust: "owner" },
      },
      default: { include: false, salience: "standard", region: "hero", prominence: 2, component: "hero-carousel" },
      heuristics: [{ when: { arrival: ["visual"] }, relevant: true }],
      fetch: async () => [{ src: "https://example.com/loaf.jpg", alt: "A sourdough loaf", name: "Sourdough" }],
    },
  ],
});
```

Rules of thumb:

- **`what` / `not_for` are the prompt.** System One models read literally. Name situation labels directly: `not_for: "Visitors with mediaBudget low"` works better than "people on slow phones".
- **`heuristics` drive the offline rules engine.** It is your fallback whenever an engine is unavailable or uncalibrated, so make it a sensible page on its own.
- **Mark third-party fields as `trust: "third-party"`** (reviews, social captions). They are rendered but never sent to a decider.
- `defineManifests` validates everything and throws with errors that name the source and field.

## 3. Turn requests into a situation

```ts
import { CORE_BUCKETS, CORE_RULES, collectEnvelope, deriveSituation } from "@web4kit/context";

const { envelope } = collectEnvelope({ url: request.url, headers: request.headers });
const situation = deriveSituation(envelope, CORE_RULES);
// { arrival: "visual", device: "mobile", familiarity: "unknown", language: "english", mediaBudget: "high" }
```

`CORE_RULES` derive `arrival`, `device`, `mediaBudget`, `familiarity` and `language`. For physical places, add `venueRules({ location, timezone, hours })` to get `visitor` (nearby/local/tourist), `mealWindow` and `openState`. You can write your own `SituationRule`: a pure function from envelope to labels. Do all maths there; System One models are weak at numbers and dates.

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
  @import "@web4kit/react/tokens.css";
  @source "../node_modules/@web4kit/react/dist";
  ```

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

Write persona fixtures: envelopes plus the page properties that must hold, plus hand-labelled answers you're sure about. Then measure an engine:

```ts
import { runEngine, type SituatedFixture } from "@web4kit/conformance";

const fixtures: SituatedFixture[] = personas.map((f) => ({ ...f, situation: deriveSituation(f.envelope, CORE_RULES) }));
const run = await runEngine({ manifests, fixtures, decider: createJevDecider(jev!), repeats: 3 });

console.log(run.invariantPassRate, run.byKind);          // accuracy and confidence on failures, per question kind
writeFileSync("calibration/jev.json", JSON.stringify(run.profile, null, 2));
```

Load the profile with `CalibrationProfileSchema.parse(JSON.parse(...))` and pass it as `calibration`. For each question kind and language, the profile holds the threshold above which the engine's answers are trusted. Combinations where the engine is as confident on wrong answers as on right ones are marked **uncalibrated** and answered by rules. That's how web4 catches silent failures.

Iterate like a designer: when an invariant fails, sharpen the `what` / `not_for` wording, re-run, and watch the numbers.

## 8. Go further

- Read `examples/restaurant` (Casa Lumbre) and `examples/db-explorer` (Meridian Supply) for complete sites with fixtures, labels and invariants.
- Run the lab (`cd apps/lab && W4_LAB_MODE=1 pnpm dev`) to see every decision in the Why panel.
- JSON Schemas for the Page Plan and decider types are in [`schemas/`](../schemas). Other languages can implement parts of web4 against them.
