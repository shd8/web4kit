# Casa Ribeira: a web4 starter

A complete [web4](https://github.com/shd8/web4) site: a boutique hotel in Porto whose home page is **planned for each visitor's situation** by a System One decision model (TypeSafe Jev), or by the offline rules engine when no key is set.

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
cp .env.example .env    # optional: add JEV_API_KEY to plan with Jev
pnpm dev             # http://localhost:3010
```

In development, the bar at the top previews each persona (`/?as=arriving-today`). A guest's booking comes from a confirmation-email link: `/?booking=CR-1042`. `/stats` shows the plan-cache hit rate, tokens and cost.

In production (`pnpm build && pnpm start`) only real request signals are used: `?src=`, referrer, device, language, CDN geo headers and local time.

## How it's built

```
web4/
  hotel.ts       hotel facts, demo bookings, a deterministic demo forecast
  situation.ts   situation rules: stayPhase, dayPart, weather, visitor (all maths here)
  manifests.ts   the ten data sources: what, audience, business rules, trust, heuristics
  data.ts        content (rooms, breakfast, events, reviews)
  fixtures.ts    personas, a fixture grid, page invariants and labels
  site.ts        createSite: Jev or rules, calibration, personas, booking enrichment
app/
  page.tsx       the site: PlanView inside your own header and footer
  stats/         planner stats
scripts/
  calibrate.ts   measure the engine on your fixtures and write calibration/
```

## Make it yours

1. **Change the content** in `web4/data.ts` and `web4/hotel.ts`.
2. **Edit the manifests.** Say who each source is for with `audience: { stayPhase: ["researching"] }`, and put hard business rules in `mustInclude` / `mustExclude`. System One models read literally.
3. **Keep the rules engine good:** `pnpm test` checks that every invariant holds with rules alone, because rules are the fallback.
4. **Recalibrate** after changing what the model sees (`what`, `not_for`, `audience`, tags): `pnpm calibrate`, about $0.05 of Jev. Headings, heuristics and defaults can change freely. Until you recalibrate, Jev's answers fall back to rules, and `/stats` says the profile is stale.

Measured on this starter (Jev 1.13, 105 fixtures, 3 repeats): **100% invariants, 100% relevance accuracy, ~8k input tokens and $0.00034 per uncached page**. A page served from the plan cache costs nothing.

## Styles

The page uses the `azulejo` theme (`data-w4-theme="azulejo"` in `app/layout.tsx`) and Tailwind v4 with `@web4kit/react/tailwind.css`. The other themes are `lumbre` and `ops`. For apps without Tailwind, import `@web4kit/react/styles.css` instead.

## License

MIT
