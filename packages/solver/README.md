# @web4kit/solver

The deterministic layout solver: region capacities and overflow demotion, structural invariants (one hero, media fallbacks), per-device grids, and seeded tie-breaking. Used by `@web4kit/planner`.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
npm install @web4kit/solver
```

## Usage

```ts
import { solve } from "@web4kit/solver";

const { layout } = solve({ candidates, device: "mobile", seed: situationHash, mediaBudget: "high" });
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
