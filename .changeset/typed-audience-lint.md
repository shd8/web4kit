---
"@web4kit/manifest": minor
"@web4kit/planner": minor
"@web4kit/next": minor
"web4kit": patch
---

`defineSourceFor(BUCKETS)`: `defineSource` bound to the site's situation buckets, so `audience`, `mustInclude`, `mustExclude` and heuristic conditions autocomplete and a misspelt bucket or label is a type error (or a `ManifestError` from JavaScript). `lintManifests(manifests, buckets?)` warns when a source's `what` is time-bound ("this morning", "today", "until 10:30") but it has no `audience`. `createSite` prints these warnings outside production and exposes them as `site.manifestWarnings()`, and `web4kit check` prints them without changing its exit code. The starters use both.
