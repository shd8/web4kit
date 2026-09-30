import { CORE_BUCKETS, CORE_RULES, collectEnvelope, deriveSituation } from "@web4kit/context";
import { defineManifests, defineSource, owner } from "@web4kit/manifest";
import { createPlanner, LruPlanCache, lintPortability } from "@web4kit/planner";
import { defaultRegistry, libraryManifests, PlanView, resolvePlanData } from "@web4kit/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 1. Describe your data sources (the manifests are the prompt).
const manifests = defineManifests({
  site: "rosa-bakery",
  components: libraryManifests,
  sources: [
    defineSource({
      id: "breads",
      shape: "list",
      label: "Today's bread",
      tags: ["bread", "prices"],
      what: "Breads baked this morning, with prices",
      freshness: "daily",
      fields: { title: owner("name"), value: owner("price") },
      default: { salience: "featured", prominence: 2, component: "menu-list" },
      fetch: async () => [
        { name: "Sourdough loaf", price: "€5.50" },
        { name: "Rye & caraway", price: "€4.80" },
      ],
    }),
    defineSource({
      id: "photos",
      shape: "media-list",
      label: "From the oven",
      tags: ["photos"],
      what: "Photos of fresh bread and pastries",
      audience: { mediaBudget: ["high"] },
      freshness: "weekly",
      fields: { image: owner("src"), imageAlt: owner("alt"), title: owner("name") },
      default: { include: false, region: "hero", prominence: 2, component: "hero-carousel" },
      heuristics: [{ when: { arrival: ["visual"] }, relevant: true }],
      fetch: async () => [
        { src: "https://example.com/loaf.jpg", alt: "A sourdough loaf", name: "Sourdough" },
      ],
    }),
  ],
});

// 2. Check the portability contract (fits Laya-class System One limits).
const lint = lintPortability(manifests, CORE_BUCKETS);

// 3. Plan a page from a real request (rules engine: offline, no key).
const planner = createPlanner({ manifests, cache: new LruPlanCache() });
const { envelope } = collectEnvelope({
  url: "https://rosa.example/?src=instagram",
  headers: { "user-agent": "Mozilla/5.0 (iPhone)" },
});
const situation = deriveSituation(envelope, CORE_RULES);
const { plan } = await planner.plan({ situation });

// 4. Render it (data is fetched at render time).
const data = await resolvePlanData(plan, manifests, {
  now: new Date(),
  viewer: { roles: [] },
  situation,
});
const html = renderToStaticMarkup(
  createElement(PlanView, { plan, data, manifests, registry: defaultRegistry }),
);

console.log(
  JSON.stringify(
    {
      lintStateTokens: lint.stateTokens,
      stats: planner.stats().pages,
      situation,
      hero: plan.layout.hero.map((b) => b.componentId),
      primary: plan.layout.primary.map((b) => b.componentId),
      htmlHasBlocks:
        html.includes('data-w4-block="breads"') && html.includes('data-w4-block="photos"'),
      bytes: html.length,
    },
    null,
    1,
  ),
);
