# Casa Ribeira: a web4 starter

A complete [web4](https://github.com/shd8/web4kit) site: a boutique hotel in Porto whose home page is **planned for each visitor's situation** by a System One decision model (TypeSafe Jev, or Laya for free local development).

| Situation | What the page leads with |
|---|---|
| Dreaming, from Instagram, evening | Douro sunset carousel, room cards, direct-booking offer |
| Comparing, from Booking.com, desktop | Room cards, offer and guest reviews |
| Arriving today, nearby | Arrival timeline, check-in status, "19 min walk" with Call/Route |
| Staying, morning | "Good morning · Sunny, 24°", breakfast menu, today's events |
| Staying, rainy evening | Indoor plans first: fado in the cellar |

## Run it

```bash
pnpm install
cp .env.example .env    # pick an engine: JEV_API_KEY for Jev, or W4_ENGINE=laya for free local Laya
pnpm dev             # http://localhost:3010
```

Without an engine the page still works: the rules engine plans it from the manifest `heuristics`, which you write by hand. That's the fallback web4 uses whenever a model is down or uncalibrated, not web4 itself, and the development bar says so. Laya needs `pnpm add @web4kit/decider-laya` (or `pnpm create web4kit --laya`); the first run downloads ~1.7 GB of weights.

In development, the bar at the top previews each persona (`/?as=arriving-today`). A guest's booking comes from a confirmation-email link: `/?booking=CR-1042`. `/stats` shows the plan-cache hit rate, tokens and cost.

In production (`pnpm build && pnpm start`) only real request signals are used: `?src=`, referrer, device, language, CDN geo headers and local time.

## The dev loop

Edit a source's `what` or `audience` in `web4/manifests.ts`, save, reload: the page re-plans.

- **Ungated in dev.** Under `pnpm dev`, a decision with no current calibration uses Jev's answer directly and is marked *ungated*. That happens when you edited the source since calibrating, or when a question kind has too few samples. In production those decisions go to rules until you recalibrate. Only the edited sources become stale.
- **X-ray.** Switch it on at the bottom right. Hover or tap a block to see every decision: answer, probability, confidence, threshold and who decided. Its summary lists the excluded sources (for example `rooms` for a staying guest) and any stale ones. It never renders in production.
- **Before you deploy.** `pnpm web4kit check` names the stale sources, and `pnpm build` warns about them too. In CI, run `pnpm web4kit check --strict`.
- **Your own components.** `pnpm web4kit add component <name> --shape <shape>` scaffolds one in `web4/components/` with a test, and registers it. See [Your own components](https://github.com/shd8/web4kit/blob/main/docs/components.md).

Search engines get every public source in a neutral order instead of a personalised page. See [SEO and crawlers](https://github.com/shd8/web4kit/blob/main/docs/seo.md).

## How it's built

```
web4/
  hotel.ts       hotel facts, demo bookings, a deterministic demo forecast
  situation.ts   situation rules: stayPhase, dayPart, weather, visitor (all maths here)
  manifests.ts   the ten data sources: what, audience, business rules, trust, heuristics
  data.ts        content (rooms, breakfast, events, reviews)
  fixtures.ts    personas, a fixture grid, page invariants and labels
  engine.ts      which engine plans pages: rules, Laya (W4_ENGINE=laya) or Jev (JEV_API_KEY)
  components/    your own components next to the library's (web4kit add component)
  site.ts        createSite: engine, calibration, personas, booking enrichment
app/
  page.tsx       the site: PlanView inside your own header and footer, plus the X-ray
  stats/         planner stats
scripts/
  calibrate.ts   measure the engine on your fixtures and write calibration/
```

## Make it yours

1. **Change the content** in `web4/data.ts` and `web4/hotel.ts`.
2. **Edit the manifests.** Say who each source is for with `audience: { stayPhase: ["researching"] }`, and put hard business rules in `mustInclude` / `mustExclude`. System One models read literally.
3. **Keep the rules engine good:** `pnpm test` checks that every invariant holds with rules alone, because rules are the fallback.
4. **Recalibrate** after changing what the model sees (`what`, `not_for`, `audience`, tags): `pnpm calibrate`, about $0.05 of Jev. Headings, heuristics and defaults can change freely. Until you recalibrate, the edited sources' answers fall back to rules in production (ungated in dev), and `/stats` and `pnpm web4kit check` name them.

Measured on this starter (Jev 1.13, 105 fixtures, 3 repeats): **100% invariants, 100% relevance accuracy, ~7.7k input tokens and $0.00032 per uncached page**. A page served from the plan cache costs nothing.

## Styles

The page uses the `azulejo` theme (`data-w4-theme="azulejo"` in `app/layout.tsx`) and Tailwind v4 with `@web4kit/react/tailwind.css`. The other themes are `lumbre` and `ops`. For apps without Tailwind, import `@web4kit/react/styles.css` instead.

## License

MIT
