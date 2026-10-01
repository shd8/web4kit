# Contributing

Thanks for helping. Bug reports, docs fixes, components, engine adapters and benchmark entries are all welcome.

## Setup

Requirements: Node ≥ 22 and pnpm 9.

```bash
git clone https://github.com/shd8/web4kit && cd web4kit
pnpm install
cp .env.example .env      # optional: JEV_API_KEY to plan with Jev
```

`apps/lab` is the place to see changes: `cd apps/lab && W4_LAB_MODE=1 pnpm dev`, then open <http://localhost:3004>. The public site is `apps/site` (`pnpm --filter @web4kit/site dev`).

## Before you open a pull request

```bash
pnpm run ci       # build, typecheck, lint, tests, URL check, web4-bench check, conformance on rules
pnpm smoke    # if you touched a package's exports or dependencies
```

`pnpm run ci` runs offline, with the rules engine only. No engine key is needed, and CI has none.

- **Format and lint:** Biome (`pnpm lint:fix`).
- **Changes to published packages need a changeset:** run `pnpm changeset` and describe the change for users. All public packages share one version.
- **Changes to what the model sees** (a source's `what`, `not_for`, `audience` or tags, a component's description, the questions) change the calibration. Say so in the pull request. Re-running calibration with Jev costs money, so a maintainer may do it for you.
- **Changes to fixtures or labels** change web4-bench. Run `pnpm bench export` and commit `bench/data`.
- **The playground's recordings** must cover the manifests. `pnpm precompute --check` says whether they do.

## Ground rules

web4 is built on **System One models**: engines that answer typed questions (`choice`, `score`, `noul`) with probabilities. Contributions that add LLM deciders or generated copy won't be merged. See the [roadmap](ROADMAP.md) for what's planned.

## Submitting a web4-bench entry

1. Produce a submission: `pnpm bench run --engine local …`, or write the JSONL yourself (see [bench/README.md](bench/README.md)).
2. Add the entry: `pnpm bench leaderboard add <submission> --id <engine-version> --publish` (leave out `--publish` if the answers can't be redistributed).
3. Open a pull request with the *benchmark entry* template. Declare your training data. Training on the test split's labels disqualifies an entry.

CI re-scores every published submission, and the scores must match exactly.

## Conduct and security

This project follows the [code of conduct](CODE_OF_CONDUCT.md). Report security issues privately, as described in [SECURITY.md](SECURITY.md).
