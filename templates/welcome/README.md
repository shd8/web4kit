# My web4 site

A [web4](https://github.com/shd8/web4) starter. The home page isn't laid out by hand: for every visitor, web4 asks a System One decision model (TypeSafe Jev, or Laya for free local development) **what** to show, **with which component**, and **where**, from the visitor's situation alone.

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

Pick the System One engine in `.env` (`cp .env.example .env`) before judging the page. Without one, the rules engine plans it from the manifest `heuristics`, which you write by hand: the previews above still change, but only because the starter's heuristics were written for those personas. Rules are the fallback web4 uses whenever a model is down or uncalibrated, not web4 itself, and the development bar says so.

| Engine | Setting | Notes |
|---|---|---|
| Rules | nothing set | Your manifest heuristics. Offline, instant, free. |
| Laya | `W4_ENGINE=laya` | An open System One model running in this process. Free and offline, good for development. Needs `@web4kit/decider-laya` (scaffold with `--laya`, or `pnpm add @web4kit/decider-laya`); the first run downloads ~1.7 GB of weights, and each new situation takes ~10 s on a laptop CPU (then it's cached). |
| Jev | `JEV_API_KEY=…` | TypeSafe Jev, hosted: the quality bar. ~300 ms and ~$0.0002 per new situation. |

In production, each engine's answers are only trusted where its calibration profile (`calibration/<engine>.json`) says so; elsewhere the rules decide. In development, uncalibrated answers are shown anyway, marked *ungated* (see [The dev loop](#the-dev-loop)). `/stats` shows the engine, calibration status, cache hits, tokens and cost.

## The dev loop

Edit a `what` or an `audience` in `web4/sources.ts`, save, reload: the page re-plans for you.

- **Ungated in dev.** Under `pnpm dev`, a decision with no current calibration uses the engine's answer directly and is marked *ungated*. That happens when you edited the source since calibrating, or when a question kind has too few samples. You see what the model makes of your new wording. In production those decisions go to rules until you run `pnpm calibrate`. Only the sources you edited become stale; the rest keep their calibration.
- **X-ray.** Switch it on with the button at the bottom right. Hover a block, or tap it on a phone, to see each decision: answer, probability, confidence, threshold and who decided (engine, rule, default, invariant, or *ungated in dev*). Its summary lists the excluded sources and any stale ones. It never renders in production.
- **When to calibrate.** `pnpm web4kit check` says whether the profile matches your sources (active, partial with the stale sources named, stale, or missing). `pnpm build` prints the same warning. Calibrate once the wording is right, before you deploy. In CI, run `pnpm web4kit check --strict`, which fails unless calibration is active.
- **Your own components.** `pnpm web4kit add component quote-card --shape record` writes `web4/components/quote-card.tsx` and its test, and registers it. The planner can choose it for every `record` source on the next reload. See [Your own components](https://github.com/shd8/web4/blob/main/docs/components.md).

## Where things are

```
web4/
  sources.ts     your data sources: what they are, who they're for (audience), defaults
  situation.ts   situation rules: request -> English labels (all maths here)
  personas.ts    preview personas, page invariants and labels for testing
  engine.ts      which engine plans pages: rules, Laya or Jev (W4_ENGINE / JEV_API_KEY)
  components/    your own components next to the library's (web4kit add component)
  site.ts        the pipeline: createSite({ manifests, situation, decider, calibration })
app/
  page.tsx       your page: PlanView inside your own header and footer, plus the X-ray
  stats/         planner stats
scripts/
  calibrate.ts   measure Jev on your personas and write calibration/
```

## Make it yours

1. **Add a source** in `web4/sources.ts` with `defineSource({ id, shape, label, what, fields, fetch })`. Shapes: `list`, `record`, `schedule`, `media-list`, `geo`, `timeseries`, `graph`.
2. **Say who it's for** with `audience: { device: ["mobile"] }`, and hard business rules with `mustInclude` / `mustExclude`.
3. **Add situation labels** in `web4/situation.ts` (for example `distanceRule`, `openingHoursRule`, or your own).
4. **Test**: `pnpm test` checks that the rules engine alone passes every page invariant (it is the fallback).
5. **Calibrate**: `pnpm calibrate` measures the configured engine on your personas and writes `calibration/`: `W4_ENGINE=laya pnpm calibrate` is free, Jev costs under $0.01. After you change a source's description or audience, that source's answers fall back to rules in production until you re-run it (`pnpm web4kit check` tells you which sources).

Measured on this starter (27 fixtures):

| Engine | Invariants | Relevance accuracy | Per uncached page |
|---|---|---|---|
| Jev 1.13 (3 repeats) | 100% | 100% | ~250 ms, $0.00017 |
| Laya (in-process) | 97.7% | 64.8% | ~9 s on CPU, free |

Laya is a much smaller model: use it to develop without spending tokens, and Jev for what visitors see. A page served from the plan cache costs nothing.

## Learn more

- [Getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md)
- A complete site: `pnpm create web4kit my-hotel --template hotel`
