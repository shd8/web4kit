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

Without a key the **rules engine** plans the page (offline, free). To plan with **Jev**, copy `.env.example` to `.env` and set `JEV_API_KEY`. `/stats` shows cache hits, tokens and cost.

## Where things are

```
web4/
  sources.ts     your data sources: what they are, who they're for (audience), defaults
  situation.ts   situation rules: request -> English labels (all maths here)
  personas.ts    preview personas, page invariants and labels for testing
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
5. **Calibrate**: `pnpm calibrate` measures Jev on your personas (under $0.01) and writes `calibration/`. Until you re-run it after changing descriptions or audiences, Jev's answers fall back to rules.

Measured on this starter (Jev 1.13, 27 fixtures, 3 repeats): **100% invariants, 100% relevance accuracy, ~4k input tokens and $0.00017 per uncached page**. A page served from the plan cache costs nothing.

## Learn more

- [Getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md)
- A complete site: `pnpm create web4kit my-hotel --template hotel`
