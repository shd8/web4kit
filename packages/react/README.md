# @web4kit/react

The fail-soft, server-renderable React renderer and the curated component library: 16 components with container queries and two themes (`lumbre`, `ops`). Ships `styles.css` (precompiled, no Tailwind needed) and `tokens.css` (for Tailwind v4 apps).

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/react
```

## Usage

```ts
import { defaultRegistry, PlanView, resolvePlanData } from "@web4kit/react";
import "@web4kit/react/styles.css";

const data = await resolvePlanData(plan, manifests, { now: new Date(), viewer: { roles: [] } });
<div data-w4-theme="lumbre"><PlanView plan={plan} data={data} manifests={manifests} registry={defaultRegistry} /></div>
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
