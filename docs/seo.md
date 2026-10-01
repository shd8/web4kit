# SEO and crawlers

A web4 page is planned for each visitor's situation. That's the point for people, and wrong for search engines. An index needs to see everything a site offers. A crawler that arrives "at 23:40 from nowhere on a desktop" shouldn't be told only that the kitchen is closed.

## What crawlers get

When a request's user agent is a known search-engine crawler (Googlebot, Bingbot, DuckDuckBot, YandexBot, Baiduspider, Applebot, Yahoo Slurp, SeznamBot or Naver Yeti), the situation is labelled `arrival: crawler`. For that label the planner makes a **complete, neutral plan**:

- **Every public source is on the page.** That includes sources hidden from people by `audience`, heuristics, `default.include: false`, `mustInclude` or `mustExclude`. Sources restricted to roles are left out, as they are for any anonymous visitor.
- **Nothing depends on the situation.** Each source uses its manifest default component, region and prominence, in manifest order. Time of day, place, language and visit history play no part. Every crawler gets the same page per device class, so Googlebot Smartphone gets the mobile layout.
- **Nothing is dropped for space.** Blocks that don't fit their region move further down the page, and the last region takes any number.
- **No model is asked.** Crawler pages cost nothing to plan and are cached like any other plan. Each block records `decided by invariant: crawler`.

Data is still fetched at render time, so the page shows current content: today's menu, the real opening hours.

## Why this isn't cloaking

Cloaking means showing search engines content that people don't get. Here crawlers see a **superset** of what any person sees: the same sources, the same data, the same components, only all of them at once and in a neutral order. Nothing appears for crawlers that a person can't get in some situation.

## Things to know

- **Spoofing is harmless.** Anyone can send a Googlebot user agent and get the complete page. That page contains only public sources, so nothing is revealed; the requester just isn't personalised. web4 doesn't verify crawlers by reverse DNS, because that would add a network lookup to the request path.
- **The list is data.** `KNOWN_CRAWLERS` in `@web4kit/context` holds the patterns. AI crawlers and link-preview bots aren't included: they get the same page as an anonymous visitor.
- **Write your own rule if you need to.** The crawler label comes from `arrivalRule`, a situation rule like any other.
