# Engines

web4 asks a **System One** decision model three kinds of typed question about each data source: is it relevant, which component shows it best, and where it goes. Every engine sits behind the same `Decider` interface, so you can switch without touching manifests, fixtures or pages. In the starters, `W4_ENGINE` and `JEV_API_KEY` pick one (`web4/engine.ts`).

| Engine | Setting | Cost and speed | Use it for |
|---|---|---|---|
| Rules | nothing set | free, instant, offline | the fallback, CI, and pages that don't need a model |
| Laya | `W4_ENGINE=laya` | free, offline, ~10 s per new situation on a laptop CPU | developing without spending tokens |
| Jev | `JEV_API_KEY=…` | ~300 ms and ~$0.0002–0.0003 per new situation | what visitors see |

A plan is cached per situation, so a page served from the plan cache costs nothing whichever engine planned it.

## Rules

`createManifestRuleDecider(manifests)` answers from your manifest `heuristics`, `audience` and defaults, with no model and no network. It is what web4 falls back to whenever an engine fails, times out, or isn't calibrated for a question. It only replays the judgement you wrote down by hand, and the starters' preview bar says so when it plans the page. `pnpm test` in a starter checks that rules alone pass every page invariant, because the fallback must always be safe.

## Laya

`@web4kit/decider-laya` runs Laya, a small open System One model, in your process on ONNX Runtime: `createInProcessLayaDecider()`. Install it with `pnpm add @web4kit/decider-laya` (or scaffold with `pnpm create web4kit --laya`). The first run downloads about 1.7 GB of weights.

Laya is much smaller than Jev. On the welcome starter it passes 97.7% of invariants with 64.8% relevance accuracy, against Jev's 100% and 100%. Use it to iterate on wording for free, and calibrate it (`W4_ENGINE=laya pnpm calibrate`) before trusting any of its answers.

## Jev

`createJevDecider(jevConfigFromEnv())` calls TypeSafe Jev, the hosted System One model, with `JEV_API_KEY` from `.env` (`JEV_BASE_URL` overrides the endpoint). Each page is one logical round: every question for every source at once. Requests that exceed Jev's limits are split and sent in parallel. Rate limits and errors fall back to rules for the affected questions, and the reason is recorded in the plan.

## Any System One endpoint

`createSystemOneHttpDecider({ baseUrl })` speaks the System One HTTP wire format, for example a local server running Laya. The lab and the conformance suite pick it up from `W4_LOCAL_ENGINE_URL`.

## Cascade

`createCascadeDecider({ cheap, strong, threshold })` answers with a cheap engine first. It re-asks the strong engine only the questions whose cheap answer falls below its calibrated threshold, and records which engine decided each one.

## Calibration decides what is trusted

No engine is trusted by default. `pnpm calibrate` measures the configured engine on your fixtures and writes `calibration/<engine>.json`: per question kind and language, the confidence above which its answers are right often enough. In production, an answer below that threshold uses the manifest default, and a question kind without a threshold uses rules. In development, answers without a current threshold are used anyway and marked *ungated*. See [Getting started](getting-started.md) and [Deploying](deploying.md).
