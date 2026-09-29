# @web4kit/ir

The Page Plan intermediate representation: `web4.plan/v1` schema (Zod + JSON Schema), validation, a privacy check that rejects user or fetched data in plans, and a portable stable hash.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
npm install @web4kit/ir
```

## Usage

```ts
import { validatePlan, planJsonSchema, assertNoUserData } from "@web4kit/ir";

const plan = validatePlan(json);         // throws on unknown versions or invalid plans
assertNoUserData(plan, { data: [...] }); // plans must never contain user or fetched data
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
