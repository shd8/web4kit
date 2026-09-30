---
"@web4kit/context": minor
"@web4kit/manifest": minor
"@web4kit/planner": minor
"@web4kit/react": minor
"@web4kit/conformance": minor
"@web4kit/next": minor
"create-web4kit": minor
---

v1 authoring API, from the frictions found building the hotel starter:

- `audience` and `mustExclude` on data sources; `defineSource` with `owner` / `system` / `thirdParty`.
- Composable `distanceRule`, `openingHoursRule`, `mealWindowRule` and `dayPartRule`; `resolveContext({ enrich })`.
- `manifests.deciderVersion`: calibration survives cosmetic edits, and stale profiles are reported and ignored. **Breaking:** regenerate stored calibration profiles.
- Planner `onPlan` hook, `planner.stats()`, and `loadCalibration` from `@web4kit/planner/node`.
- `FetchContext.situation`, the `upcoming` schedule status, and `@web4kit/react/tailwind.css`.
- Conformance builders: `label`, `invariant`, `labelsFrom`, `invariantsFrom`, `grid`, `situate`, `manifestInvariants`.
- New `@web4kit/next` adapter: `createSite`, `site.page()`, `site.handle()`, `PreviewBar`.
- `create-web4kit`: a new default `welcome` template (the hotel is `--template hotel`); run from a web4 checkout, it bundles the local packages so it works before publishing.
- Renderer: the last block of a row widens to fill it, so rows no longer end with a gap.
