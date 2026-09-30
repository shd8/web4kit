# web4

**Pages planned per visitor by System One decision models.**

Traditional web pages are decided at build time: every visitor gets the same content, components and layout. web4 moves those decisions to request time. For each visitor's *situation* (how they arrived, where from, on what device, at what local time), a System One model such as [TypeSafe Jev](https://docs.typesafe.ai) decides **what** to show, **how** to show it and **where** to put it. Deterministic code then lays the page out and renders it.

Same URL, different page, and never a broken one.

| Tourist from Instagram, 20:30 | Nearby, from Google Maps, 13:10 | Late night, closed, 23:40 |
|---|---|---|
| Photo carousel hero, dinner menu, Instagram grid, map | "15 min walk" with Call/Route, today's lunch, open-now hours | "Closed · opens tomorrow at 13:00" banner |

> Status: **experimental (v0, read-only pages)**. The concepts, contracts and numbers here are real; the APIs will change.

## Why System One models

System One models (Jev, and small Jev-like open models such as Laya) do not generate text. They answer typed questions (`choice`, `score`, `noul`) with calibrated probabilities in about 0.1–0.3 s. That makes page planning a *selection* problem over things you declared, not a generation problem:

- **Cheap:** about 6.7k input tokens per page, **≈ $0.0003 per uncached page** on Jev, and $0 on a plan-cache hit.
- **Fast:** p50 ≈ 280 ms on Jev for a whole page (one decider round), ~1 ms from cache.
- **Safe:** answers are constrained to your options, and nothing is generated. Third-party text (reviews, social captions) never reaches the model.
- **Explainable:** every block records the probabilities, confidence and threshold behind it.

web4 is built on System One models by design. It does not use LLMs to decide or to write copy.

## How it works

```
request
  │
  ▼
Context Envelope ── Tier 0 signals: ?src / utm, Referer, CDN geo, Accept-Language,
  │                 device, Save-Data, local time, consented visit cookie
  ▼
Situation ───────── English labels from closed sets (visitor=tourist, arrival=visual,
  │                 mealWindow=dinner, openState=open, …). All math happens here.
  ▼
one decider round ─ for every data source, in parallel:
  │   A  WHAT   relevance (noul) · salience (score)
  │   B  HOW    component (choice among shape-compatible components)
  │   C  WHERE  region (choice) · prominence (score)
  ▼
confidence gating ─ calibrated threshold per engine × question kind × language;
  │                 below → manifest default; uncalibrated → rules
  ▼
layout solver ───── region capacities, invariants, per-device grid, seeded ties
  │
  ▼
Page Plan (JSON) ── decisions only, no user data → cached per situation
  │
  ▼
renderer ────────── data fetched fresh at render time, fail-soft blocks, SSR
```

- **The decider decides meaning; code decides mechanics.**
- **Manifests replace pages.** You describe data sources (shape, owner-written `what`, `audience`, business rules, trust per field, defaults, heuristics) and components (accepted shapes, affordances, footprints). The manifests *are* the prompt.
- **Engines are interchangeable** behind the `Decider` interface: hosted Jev, Laya (through Ollaya or in-process ONNX), a deterministic rules engine, or a cascade (a cheap engine first, escalating to Jev on low confidence).
- **The conformance suite** plans hundreds of persona fixtures per engine. It measures accuracy *and confidence on failures*, then writes the calibration profiles the planner uses. An engine that is confidently wrong is marked uncalibrated and falls back to rules instead of failing silently.

## Start a site

```bash
pnpm create web4kit my-site    # once published
cd my-site && pnpm install && pnpm dev
```

Until the packages are on npm, run the scaffolder from this checkout. It works from any folder and bundles the local packages into `my-site/.web4kit`:

```bash
node /path/to/web4/packages/create-web4kit/index.mjs my-site
cd my-site && pnpm install && pnpm dev    # http://localhost:3000 (npm and yarn work too)
```

| Template | |
|---|---|
| `welcome` (default) | A welcome page planned by web4 itself: get-started steps, the situation it was planned from, notes that only some visitors see. Three personas, calibrated on Jev (100% invariants and relevance, $0.00017 per uncached page). See [`templates/welcome`](templates/welcome). |
| `hotel` (`--template hotel`) | **Casa Ribeira**, a boutique hotel in Porto: five personas (dreaming, comparing, arriving today, staying in the morning, staying on a rainy evening), business rules, a conformance suite and a `/stats` page. Calibrated on Jev: 100% invariants, 100% relevance, $0.00034 per uncached page. See [`templates/hotel`](templates/hotel). |

## Use the packages

```bash
pnpm add @web4kit/context @web4kit/manifest @web4kit/planner @web4kit/react react react-dom
```

**[Getting started →](docs/getting-started.md)** builds a small site from scratch: manifests, situation, plan, render, Jev and calibration.

| Package | What it is |
|---|---|
| [`@web4kit/planner`](packages/planner) | One decider round per page, confidence gating, plan cache, portability lint |
| [`@web4kit/next`](packages/next) | Next.js adapter: one call per page from a server component, dev-only persona previews, stats |
| [`@web4kit/react`](packages/react) | Fail-soft renderer and curated component library (`styles.css` / `tailwind.css`) |
| [`@web4kit/context`](packages/context) | Context Envelope and situation rules |
| [`@web4kit/manifest`](packages/manifest) | Data-source and component manifests |
| [`@web4kit/decider`](packages/decider) | Decider interface; rules, System One HTTP (Jev, Ollaya) and cascade adapters |
| [`@web4kit/decider-laya`](packages/decider-laya) | In-process Laya (ONNX) decider |
| [`@web4kit/conformance`](packages/conformance) | Fixture grids, label and invariant builders, per-engine evaluation, calibration profiles |
| [`@web4kit/ir`](packages/ir) | Page Plan schema (`web4.plan/v1`), validation, privacy check |
| [`@web4kit/solver`](packages/solver) | Deterministic layout solver |
| [`create-web4kit`](packages/create-web4kit) | Scaffolder for the Casa Ribeira starter |

## Run this repository

Requirements: Node ≥ 22 and pnpm 9.

```bash
pnpm install
cp .env.example .env          # optional: add JEV_API_KEY to plan with Jev
cd apps/lab && W4_LAB_MODE=1 pnpm dev
```

Open <http://localhost:3004>:

- `/restaurant` is **Casa Lumbre**, a fire-grill restaurant in Madrid. Try the personas, drag the local time past closing, or switch arrival source, distance, language or Data saver.
- `/db-explorer` is **Meridian Supply**, an operations explorer. Switch the role, or ask a question such as "Which suppliers are late this month?".
- `/gallery` shows every component at every footprint.

Use the **engine switcher** (Rules / Jev) and the **Why** panel to see each decision. Without `JEV_API_KEY`, everything runs on the offline rules engine.

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | Type-check and build every package and the lab |
| `pnpm test` | Unit tests (offline) |
| `pnpm lint` | Biome lint and format check |
| `pnpm conformance --engines rules,jev --write` | Run the conformance suite and write `calibration/` and `reports/` |
| `node scripts/ci.mjs` | Full offline CI: build, typecheck, lint, tests, conformance on rules |
| `pnpm smoke` | Pack every package, install into a clean project, typecheck with TS 5.9 and run |
| `pnpm changeset` | Describe a change for the next release (Changesets) |
| `W4_LIVE=1 pnpm --filter @web4kit/example-restaurant test` | Live planning test against Jev |

## Releasing

Versions are managed with [Changesets](https://github.com/changesets/changesets); all `@web4kit/*` packages share one version. On `main`, the Release workflow opens a *Version Packages* PR, and merging it publishes to npm (with provenance once the repository is public). It is opt-in: set the repository variable `RELEASE_ENABLED=true` and add an `NPM_TOKEN` secret (a granular npm token with publish rights on `@web4kit` and 2FA bypass).

## Repository layout

```
packages/
  ir            Page Plan schema (web4.plan/v1), validation, privacy check, stable hash
  decider       Decider interface, confidence, request fitting, rules / HTTP / cascade adapters
  decider-laya  In-process Laya (ONNX) decider
  context       Context Envelope, situation rules, situation hash, lab overrides
  manifest      Data-source and component manifests, validation, versioning
  planner       Question generation, portability lint, gating, plan cache, planner
  solver        Deterministic layout solver
  react         Renderer and the curated component library (Tailwind v4, container queries)
  conformance   Fixtures, invariants, runner, calibration, reports
templates/      welcome (default) and hotel (Casa Ribeira): the create-web4kit templates
apps/lab        Next.js lab: context panel, personas, engine switcher, Why panel
examples/       restaurant (Casa Lumbre) and db-explorer (Meridian Supply)
schemas/        Language-neutral JSON Schemas: the canonical contracts
calibration/    Generated calibration profiles per site and engine
reports/        Generated conformance reports
```

## Measured results (Jev 1.13, 3 repeats)

| | Casa Lumbre | Meridian Supply |
|---|---|---|
| Fixtures | 164 | 113 |
| Invariant pass rate | 100% | 100% |
| Relevance accuracy | 100% | 97.1% (rules: 56%) |
| Tokens per uncached page | 6,664 | 7,251 |
| Cost per uncached page | $0.00028 | $0.00030 |
| Latency p50 / p95 | 278 / 346 ms | 284 / 353 ms |

The full reports are in [`reports/`](reports).

## Limitations and roadmap

- v0 renders read-only pages: no actions such as booking.
- Manifests are written by hand. Importing them from Google Business, Instagram or a POS is the path to real adoption.
- Owner-written labels are English only; content is localised by the data layer.
- Local Laya works offline, but on these examples it is not accurate enough to plan pages alone. Use it through the cascade.
- Deciding on the device, in the browser, is a future option.

## License

[MIT](LICENSE)
