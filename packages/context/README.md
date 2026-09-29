# @web4kit/context

The Context Envelope, built from Tier 0 request signals only (no fingerprinting), and situation rules that turn it into English labels from closed sets. The labels are the only thing a decider ever sees. Includes venue rules (nearby/local/tourist, meal window, open state) and a stable situation hash.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
npm install @web4kit/context
```

## Usage

```ts
import { CORE_RULES, collectEnvelope, deriveSituation } from "@web4kit/context";

const { envelope } = collectEnvelope({ url: request.url, headers: request.headers });
const situation = deriveSituation(envelope, CORE_RULES); // { arrival: "visual", device: "mobile", … }
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
