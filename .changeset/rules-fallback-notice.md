---
"@web4kit/manifest": minor
"@web4kit/react": minor
"@web4kit/next": minor
"create-web4kit": minor
---

Make it visible when pages are planned by the rules fallback instead of a model:

- `PreviewBar` shows a notice when the page was planned by rules alone, or by an engine whose calibration profile is missing or stale (`engineNotice()`).
- `FetchContext.engine`: the engine the plan was made with (`"rules"` without a decider), set by `resolvePlanData`, so owner copy that describes how the page was planned stays true.
- `create-web4kit` asks you to pick an engine after scaffolding, and says `pnpm add @web4kit/decider-laya` instead of re-creating with `--laya`.
