# @web4kit/decider-laya

An in-process `Decider` running the open [Laya](https://huggingface.co/convaiinnovations/laya) System One model on ONNX Runtime. It runs fully offline once the weights (~1.7 GB) are cached, and the weights are pinned to an exact revision.

Part of [web4](https://github.com/shd8/web4kit): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/decider-laya
```

## Usage

```ts
import { createInProcessLayaDecider } from "@web4kit/decider-laya";

const laya = await createInProcessLayaDecider(); // downloads and caches weights on first use
```

See the [getting started guide](https://github.com/shd8/web4kit/blob/main/docs/getting-started.md).

## License

MIT
