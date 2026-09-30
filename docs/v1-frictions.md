# API frictions found building the Casa Ribeira starter

The hotel starter (`templates/next-starter`) was built only against the public `@web4kit/*` API. Everything below was actually hit while building it.

**Status: all 12 resolved in v1** (OpenSpec change `web4-v1-authoring`). Each item ends with what shipped.

## Modelling

1. **`venueRules` is all-or-nothing.** It bundles distance (`visitor`), meal window and opening state. The hotel needed distance but not meals, so it had to reimplement `visitorRule`.
   → Split it into `distanceRule(location)`, `openingHoursRule(hours)` and `mealWindowRule(timezone)`.
   ✅ `distanceRule`, `openingHoursRule`, `mealWindowRule` and `dayPartRule` in `@web4kit/context`; `venueRules` composes the first three with byte-identical labels.
2. **Audience wording is a footgun.** Jev's only errors on the hotel came from `not_for` sentences that listed some stay phases and forgot others: `rooms` was shown to already-booked guests, and `today` to arriving guests. Fixing the wording took relevance from 93.3% to 99.8%.
   → Add a structured `audience: { stayPhase: ["researching"] }` field. The planner would render it into question text consistently, and the rules engine would use it too, so it's written once and can't drift.
   ✅ `audience` on data sources, rendered by `describeAudience`, applied by the rules engine (heuristics can't override it). Hotel relevance on Jev: 99.8% → 100%.
3. **`mustInclude` without `mustExclude`.** "Never show room prices to a guest who is already staying" is a business rule, but today it can only be expressed through wording and heuristics.
   → Add `mustExclude`, enforced by the solver as an invariant.
   ✅ `mustExclude`, enforced by the planner and recorded as decided by invariant; exclusion wins over `mustInclude`.
4. **Fetchers can't see the situation.** The check-in block couldn't say "check-out until 11:00" to a staying guest; it could only be hidden.
   → Pass the (label-only) `situation` in `FetchContext`.
   ✅ `FetchContext.situation`; the hotel's check-in block shows check-out to staying guests.
5. **The schedule shape has no "not yet open" state.** "Check-in opens at 15:00" renders with the red "closed" tone, which suits a closed restaurant but not an arrival.
   → Add a neutral `upcoming` status to `ScheduleData`.
   ✅ `ScheduleData.status: "upcoming"`, rendered in the primary tone.

## Calibration

6. **Any manifest edit invalidates calibration, even a heading.** `manifestVersion` hashes every field except `fetch`, including `label` and `eyebrow`, which never reach a decider.
   → Version the decider-visible surface separately (`what`, `not_for`, `tags`, shapes, component `what`) so cosmetic edits keep the profile.
   ✅ `manifests.deciderVersion`; profiles match on it, and the planner reports `calibrationStatus` (none / active / stale) and ignores stale profiles.
7. **Labels and invariants are verbose to write.** Every site re-implements an `add(kind, source, accept)` helper and a fixture grid.
   → Provide `label.relevant("rooms").when(...)` style builders and a `grid({ axes })` fixture helper in `@web4kit/conformance`.
   ✅ `label.*`, `labelsFrom`, `invariant.*`, `invariantsFrom`, `grid`, `situate` and `manifestInvariants`.

## Integration

8. **First-party facts are resolved by hand.** The site has to look up the booking and merge `firstParty` into the envelope before planning.
   → Add an `enrich(envelope, request)` hook to `resolveContext`.
   ✅ `resolveContext({ enrich })` (real requests only); async `enrich` in `@web4kit/next`.
9. **There's Next.js boilerplate on every page:** converting `headers()` and `searchParams` to a `RequestLike`, dev-only persona previews, fetch context.
   → Add a `@web4kit/next` adapter: `const page = await planPage({ manifests, planner })` in a server component.
   ✅ `@web4kit/next`: `createSite(...)`, `await site.page({ searchParams })`, `site.handle(request)`, `PreviewBar`.
10. **Instrumentation is manual.** `/stats` wraps every `plan()` call by hand.
    → Add a planner `onPlan(result)` hook, or built-in counters (cache hits, tokens, cost).
   ✅ Both: `onPlan` and `planner.stats()`.
11. **Manifest boilerplate.** `owner()` / `thirdParty()` helpers and `freshness` / `access` / `heuristics: []` defaults are repeated in every source.
    → Add a `defineSource({...})` helper with defaults and trust shorthands.
   ✅ `defineSource`, `owner`, `system`, `thirdParty` in `@web4kit/manifest` (trust is never defaulted).

## Styling

12. **Tailwind needs an `@source` into `node_modules`,** which is fragile across package managers. The precompiled `styles.css` works, but it can't be themed through Tailwind.
    → Ship a Tailwind v4 plugin (`@plugin "@web4kit/react/tailwind"`) that registers the sources and tokens.
   ✅ `@import "@web4kit/react/tailwind.css"` (a package-relative `@source` plus tokens; a JS `@plugin` can't register sources). The smoke test checks the built CSS.
