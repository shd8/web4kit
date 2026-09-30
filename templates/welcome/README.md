# My web4 site

A [web4](https://github.com/shd8/web4) starter. The home page isn't laid out by hand: for every visitor, web4 asks a System One decision model (TypeSafe Jev, or the offline rules engine) **what** to show, **with which component**, and **where**, from the visitor's situation alone.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Open it, then use the bar at the top to preview other visitors:

| Preview | What changes |
|---|---|
| `/?as=first-visit` | Welcome, get-started steps, and your situation in the side column |
| `/?as=from-instagram` | A note for visual arrivals and a phone note appear; the situation table moves down |
| `/?as=night-owl` | A late-night note appears |

### Engines

Pick the System One engine in `.env` (`cp .env.example .env`):

| Engine | Setting | Notes |
|---|---|---|
| Rules | nothing set | Your manifest heuristics. Offline, instant, free. |
| Laya | `W4_ENGINE=laya` | An open System One model running in this process. Free and offline, good for development. Needs `@web4kit/decider-laya` (scaffold with `--laya`, or `pnpm add @web4kit/decider-laya`); the first run downloads ~1.7 GB of weights, and each new situation takes ~10 s on a laptop CPU (then it's cached). |
| Jev | `JEV_API_KEY=…` | TypeSafe Jev, hosted: the quality bar. ~300 ms and ~$0.0002 per new situation. |

Each engine's answers are only trusted where its calibration profile (`calibration/<engine>.json`) says so; elsewhere the rules decide. `/stats` shows the engine, calibration status, cache hits, tokens and cost.

## Where things are

```
web4/
  sources.ts     your data sources: what they are, who they're for (audience), defaults
  situation.ts   situation rules: request -> English labels (all maths here)
  personas.ts    preview personas, page invariants and labels for testing
  engine.ts      which engine plans pages: rules, Laya or Jev (W4_ENGINE / JEV_API_KEY)
  site.ts        the pipeline: createSite({ manifests, situation, decider, calibration })
app/
  page.tsx       your page: PlanView inside your own header and footer
  stats/         planner stats
scripts/
  calibrate.ts   measure Jev on your personas and write calibration/
```

## Make it yours

1. **Add a source** in `web4/sources.ts` with `defineSource({ id, shape, label, what, fields, fetch })`. Shapes: `list`, `record`, `schedule`, `media-list`, `geo`, `timeseries`, `graph`.
2. **Say who it's for** with `audience: { device: ["mobile"] }`, and hard business rules with `mustInclude` / `mustExclude`.
3. **Add situation labels** in `web4/situation.ts` (for example `distanceRule`, `openingHoursRule`, or your own).
4. **Test**: `pnpm test` checks that the rules engine alone passes every page invariant (it is the fallback).
5. **Calibrate**: `pnpm calibrate` measures the configured engine on your personas and writes `calibration/`: `W4_ENGINE=laya pnpm calibrate` is free, Jev costs under $0.01. Until you re-run it after changing descriptions or audiences, the engine's answers fall back to rules.

Measured on this starter (27 fixtures):

| Engine | Invariants | Relevance accuracy | Per uncached page |
|---|---|---|---|
| Jev 1.13 (3 repeats) | 100% | 100% | ~250 ms, $0.00017 |
| Laya (in-process) | 97.7% | 64.8% | ~9 s on CPU, free |

Laya is a much smaller model: use it to develop without spending tokens, and Jev for what visitors see. A page served from the plan cache costs nothing.

## Learn more

- [Getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md)
- A complete site: `pnpm create web4kit my-hotel --template hotel`
