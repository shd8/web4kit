# @web4kit/planner

The web4 planner. It sends one decider round per page (Stage A what, B how, C where) and gates each answer by calibrated confidence, falling back to manifest defaults or rules. It includes hierarchical choice for large catalogs, a build-time portability lint (Laya-class limits), a plan cache, and a recorded "why" for every decision.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/planner
```

## Usage

```ts
import { createPlanner, LruPlanCache } from "@web4kit/planner";

import { loadCalibration } from "@web4kit/planner/node";

const calibration = loadCalibration("calibration", decider.id); // undefined when missing
const planner = createPlanner({ manifests, decider, calibration, cache: new LruPlanCache() });
const { plan, cacheHit } = await planner.plan({ situation });

planner.calibrationStatus; // { status: "active" | "stale" | "none", ... }: stale profiles are ignored
planner.stats();           // pages, cache hits, decider requests, tokens, cost, distinct situations
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
