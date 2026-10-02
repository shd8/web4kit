# @web4kit/conformance

## 0.2.1

### Patch Changes

- @web4kit/context@0.2.1
- @web4kit/decider@0.2.1
- @web4kit/ir@0.2.1
- @web4kit/manifest@0.2.1
- @web4kit/planner@0.2.1

## 0.2.0

### Minor Changes

- 98d9d83: First public release. The repository moved to `github.com/shd8/web4kit` and the site is at <https://shd8.github.io/web4kit/>. `web4kit` is now the developer CLI (it replaces the 0.0.1 placeholder) and `pnpm create web4kit` scaffolds a site from npm.
- de86db6: v1 authoring API, from the frictions found building the hotel starter:

  - `audience` and `mustExclude` on data sources; `defineSource` with `owner` / `system` / `thirdParty`.
  - Composable `distanceRule`, `openingHoursRule`, `mealWindowRule` and `dayPartRule`; `resolveContext({ enrich })`.
  - `manifests.deciderVersion`: calibration survives cosmetic edits, and stale profiles are reported and ignored. **Breaking:** regenerate stored calibration profiles.
  - Planner `onPlan` hook, `planner.stats()`, and `loadCalibration` from `@web4kit/planner/node`.
  - `FetchContext.situation`, the `upcoming` schedule status, and `@web4kit/react/tailwind.css`.
  - Conformance builders: `label`, `invariant`, `labelsFrom`, `invariantsFrom`, `grid`, `situate`, `manifestInvariants`.
  - New `@web4kit/next` adapter: `createSite`, `site.page()`, `site.handle()`, `PreviewBar`.
  - `create-web4kit`: a new default `welcome` template (the hotel is `--template hotel`); run from a web4 checkout, it bundles the local packages so it works before publishing.
  - Renderer: the last block of a row widens to fill it, so rows no longer end with a gap.
  - `mustInclude: "always"` for blocks every page needs; the engine is no longer asked about sources a `mustExclude` removes (~11% fewer tokens for the hotel's arriving and staying guests).

### Patch Changes

- Updated dependencies [98d9d83]
- Updated dependencies [ba1296a]
- Updated dependencies [de86db6]
  - @web4kit/context@0.2.0
  - @web4kit/decider@0.2.0
  - @web4kit/ir@0.2.0
  - @web4kit/manifest@0.2.0
  - @web4kit/planner@0.2.0
