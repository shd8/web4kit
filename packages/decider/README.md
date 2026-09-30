# @web4kit/decider

The engine-agnostic `Decider` interface over System One (Jev-like) models: the System One wire shape, capability descriptors, uniform confidence, concurrent request fitting, and adapters for rules, any `/v1/systemone` HTTP endpoint (Jev, Ollaya), and cascades. `@web4kit/decider/node` adds a Node-only `.env` loader.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/decider
```

## Usage

```ts
import { createJevDecider, jevConfigFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";

loadDotEnv();
const jev = createJevDecider(jevConfigFromEnv()!); // reads JEV_API_KEY
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
