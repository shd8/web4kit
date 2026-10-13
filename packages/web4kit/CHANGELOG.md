# web4kit

## 0.3.0

### Patch Changes

- e0d2fc5: `defineSourceFor(BUCKETS)`: `defineSource` bound to the site's situation buckets, so `audience`, `mustInclude`, `mustExclude` and heuristic conditions autocomplete and a misspelt bucket or label is a type error (or a `ManifestError` from JavaScript). `lintManifests(manifests, buckets?)` warns when a source's `what` is time-bound ("this morning", "today", "until 10:30") but it has no `audience`. `createSite` prints these warnings outside production and exposes them as `site.manifestWarnings()`, and `web4kit check` prints them without changing its exit code. The starters use both.

## 0.2.0

### Minor Changes

- 98d9d83: First public release. The repository moved to `github.com/shd8/web4kit` and the site is at <https://shd8.github.io/web4kit/>. `web4kit` is now the developer CLI (it replaces the 0.0.1 placeholder) and `pnpm create web4kit` scaffolds a site from npm.
