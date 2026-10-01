# Deploying

A web4 site is an ordinary Next.js app. Each page is planned on the server for the request's situation, so it needs a server runtime (Node, or a serverless function), not a static export. Deploy it wherever you deploy Next.js: Vercel, Netlify, a container, or `pnpm build && pnpm start` on your own machine.

## Environment

| Variable | What it does |
|---|---|
| `JEV_API_KEY` | Plan with Jev. Without it (and without `W4_ENGINE`), pages are planned by rules. |
| `W4_ENGINE` | `jev`, `laya` or `rules`, to choose explicitly. |
| `JEV_BASE_URL` | Another Jev endpoint. |
| `W4_STRICT_CALIBRATION=1` | Fail `next build` unless calibration is active for the configured engine. |

Set them in your host's environment settings, not in a committed `.env`.

## Calibration ships with the app

The profiles in `calibration/` are read at startup, and Next's output tracing includes them in the server bundle, so serverless deploys get them with no extra config. A profile matches your manifests source by source. When a deploy changes what the model reads (`what`, `not_for`, `audience`, tags, component descriptions), those sources' answers fall back to rules in production until you recalibrate. Make CI catch that before it ships:

```bash
pnpm web4kit check --strict   # fails unless the profile is current for every source
```

`next build` prints the same warning, and fails with `W4_STRICT_CALIBRATION=1`. Run `pnpm calibrate`, commit the new profile and deploy.

## What production does differently

- **Gating:** only calibrated answers are used. Development's *ungated* answers never happen with `NODE_ENV=production`.
- **No previews or X-ray:** `?as=<persona>` is ignored, and the X-ray overlay renders nothing.
- **Real signals only:** situations come from the request: `?src=`, the referrer, device, language, CDN geo headers (Vercel and Cloudflare are read out of the box) and local time.
- **Crawlers:** known search-engine crawlers get a complete, neutral page with no engine call. See [SEO and crawlers](seo.md).

## Costs and caching

Plans are cached per situation in memory: an LRU of 1,000 plans per server process by default, configurable with `cache` in `createSite`. Most visitors share a situation, so most pages cost no engine call. `/stats` in the starters shows the hit rate, tokens and cost per page. On serverless, each cold instance starts with an empty cache. `PlanCache` is a synchronous `get`/`set` interface, so you can pass your own in-process cache, but a shared network cache isn't supported yet.
