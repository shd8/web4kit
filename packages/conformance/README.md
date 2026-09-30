# @web4kit/conformance

The conformance suite: persona fixtures, combinatorial expansion, page invariants, and per-engine evaluation (accuracy, confidence on failures, flip rate, latency, cost). It generates the calibration profiles the planner uses, marking silently failing combinations uncalibrated.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/conformance
```

## Usage

```ts
import { runEngine } from "@web4kit/conformance";

const run = await runEngine({ manifests, fixtures, decider, repeats: 3 });
writeFileSync("calibration/jev.json", JSON.stringify(run.profile, null, 2));
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
