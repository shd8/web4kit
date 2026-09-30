# @web4kit/manifest

Declarative data-source and component manifests that replace hand-written pages: shapes, owner-written `what`/`not_for`, per-field trust, defaults, heuristics and footprints. Validation errors name the source and field; versions are content-derived.

Part of [web4](https://github.com/shd8/web4): pages planned per visitor by System One decision models.

> Experimental (0.x): APIs may change between minor versions.

## Install

```bash
pnpm add @web4kit/manifest
```

## Usage

```ts
import { defineManifests } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";

export const manifests = defineManifests({ site: "my-site", sources: [/* … */], components: libraryManifests });
```

See the [getting started guide](https://github.com/shd8/web4/blob/main/docs/getting-started.md).

## License

MIT
