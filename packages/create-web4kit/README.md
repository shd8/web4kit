# create-web4kit

Scaffold a [web4](https://github.com/shd8/web4) site: a Next.js app whose pages are planned for each visitor's situation by a System One decision model (TypeSafe Jev), or by the offline rules engine.

```bash
npm create web4kit@latest my-site
cd my-site && npm install && npm run dev
```

| Template | What you get |
|---|---|
| `welcome` (default) | A welcome page, planned by web4 itself: get-started steps, the situation it was planned from, notes that appear only for some visitors. Three personas, calibrated. |
| `hotel` | Casa Ribeira, a complete boutique-hotel site in Porto: five personas, ten sources, business rules, a conformance suite. |

```bash
npm create web4kit@latest my-hotel -- --template hotel
```

Run from a web4 checkout (`node <web4>/packages/create-web4kit/index.mjs my-site`), the scaffolder bundles the local `@web4kit/*` packages as tarballs in `my-site/.web4kit`, so it works before anything is published. Pass `--registry` to use the published packages instead.

MIT
