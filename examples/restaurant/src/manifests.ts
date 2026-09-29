import { distanceKm } from "@web4kit/context";
import {
  type DataSourceManifestInput,
  defineManifests,
  type FetchContext,
} from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";
import {
  DINNER_MENU,
  DISH_PHOTOS,
  type Dish,
  EVENTS,
  INSTAGRAM,
  LUNCH_MENU,
  REVIEWS,
  WHATS_NEW,
} from "./data";
import { scheduleData, VENUE } from "./venue";

const es = (ctx: FetchContext) => ctx.language === "spanish";
const dishes = (list: Dish[]) => async (ctx: FetchContext) =>
  list.map((d) => ({
    name: es(ctx) ? d.name_es : d.name_en,
    desc: es(ctx) ? d.desc_es : d.desc_en,
    price: d.price,
    tags: d.tags,
    badge: d.badge,
  }));

const owner = (path: string) => ({ path, trust: "owner" as const });
const thirdParty = (path: string) => ({ path, trust: "third-party" as const });

/**
 * Casa Lumbre manifests. Heuristics drive the rules decider and double as the "what a good
 * designer would do" baseline; they are applied in order, later ones override earlier ones.
 */
export const sources: DataSourceManifestInput[] = [
  {
    id: "dish-photos",
    shape: "media-list",
    label: "From the grill",
    eyebrow: "Casa Lumbre · Lavapiés",
    tags: ["food", "photos", "signature dishes"],
    what: "Photos of the signature dishes cooked over holm-oak fire",
    not_for: "Prices, opening hours or directions",
    freshness: "weekly",
    access: "public",
    fields: {
      image: owner("src"),
      imageAlt: owner("alt"),
      title: owner("name"),
      caption: owner("text"),
    },
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "image-grid",
    },
    heuristics: [
      {
        when: { arrival: ["visual"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
        component: "hero-carousel",
      },
      {
        when: { visitor: ["tourist"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
        component: "hero-carousel",
      },
      {
        when: { familiarity: ["regular"] },
        salience: "minor",
        region: "secondary",
        prominence: 0,
        component: "image-grid",
      },
      {
        when: { arrival: ["transactional"] },
        salience: "minor",
        region: "secondary",
        prominence: 0,
      },
      {
        when: { openState: ["closed"] },
        region: "secondary",
        prominence: 0,
        component: "image-grid",
      },
    ],
    fetch: async (ctx) =>
      DISH_PHOTOS.map((p) => ({
        src: p.src,
        alt: p.alt,
        name: es(ctx) ? p.name_es : p.name_en,
        text: es(ctx) ? p.text_es : p.text_en,
      })),
  },
  {
    id: "instagram",
    shape: "media-list",
    label: "@casalumbre",
    eyebrow: "On Instagram",
    tags: ["social", "photos", "atmosphere"],
    what: "Recent Instagram posts showing the kitchen, the room and the dishes",
    not_for: "Visitors with arrival transactional, who want directions",
    freshness: "daily",
    access: "public",
    fields: {
      image: owner("src"),
      imageAlt: owner("alt"),
      caption: thirdParty("caption"),
      href: owner("url"),
    },
    default: {
      include: false,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "social-grid",
    },
    heuristics: [
      {
        when: { arrival: ["visual"] },
        relevant: true,
        salience: "standard",
        region: "primary",
        prominence: 1,
      },
      {
        when: { visitor: ["tourist"], arrival: ["direct", "evaluating"] },
        relevant: true,
        salience: "minor",
        region: "secondary",
      },
      { when: { openState: ["closed"], arrival: ["visual"] }, region: "secondary", prominence: 0 },
    ],
    fetch: async () => INSTAGRAM,
  },
  {
    id: "dinner-menu",
    shape: "list",
    label: "Tonight's menu",
    eyebrow: "Dinner · from 20:00",
    tags: ["food", "menu", "prices", "dinner"],
    what: "The dinner menu with dishes, short descriptions and prices",
    not_for: "The weekday lunch set menu",
    freshness: "daily",
    access: "public",
    fields: {
      title: owner("name"),
      subtitle: owner("desc"),
      value: owner("price"),
      tags: owner("tags"),
      badge: owner("badge"),
    },
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "menu-list",
    },
    heuristics: [
      {
        when: { mealWindow: ["afternoon", "dinner"] },
        salience: "featured",
        region: "primary",
        prominence: 2,
      },
      {
        when: { mealWindow: ["breakfast", "lunch"] },
        salience: "minor",
        region: "secondary",
        prominence: 0,
      },
      { when: { openState: ["closed"] }, salience: "minor", region: "secondary", prominence: 0 },
      { when: { familiarity: ["regular"], mealWindow: ["lunch"] }, relevant: false },
    ],
    fetch: dishes(DINNER_MENU),
  },
  {
    id: "lunch-menu",
    shape: "list",
    label: "Today's lunch",
    eyebrow: "Menú del día · 13:00–16:00",
    tags: ["food", "menu", "lunch", "set menu"],
    what: "The weekday lunch set menu: three courses, bread and wine at a fixed price",
    not_for: "Any visitor whose mealWindow is not lunch, or any time openState is closed",
    freshness: "daily",
    access: "public",
    fields: {
      title: owner("name"),
      subtitle: owner("desc"),
      value: owner("price"),
      tags: owner("tags"),
      badge: owner("badge"),
    },
    default: {
      include: false,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "menu-list",
    },
    heuristics: [
      {
        when: { mealWindow: ["breakfast", "lunch"] },
        relevant: true,
        salience: "featured",
        region: "primary",
        prominence: 2,
      },
      { when: { openState: ["closed"] }, relevant: false },
    ],
    fetch: dishes(LUNCH_MENU),
  },
  {
    id: "hours",
    shape: "schedule",
    label: "Opening hours",
    tags: ["hours", "open now"],
    what: "Opening hours for the week and whether the restaurant is open right now",
    freshness: "live",
    access: "public",
    fields: {},
    default: {
      include: true,
      salience: "minor",
      region: "aside",
      prominence: 0,
      component: "hours-card",
    },
    mustInclude: { openState: ["closed", "closing-soon"] },
    heuristics: [
      {
        when: { arrival: ["transactional"] },
        salience: "standard",
        region: "primary",
        prominence: 1,
      },
      {
        when: { openState: ["closing-soon"] },
        salience: "featured",
        region: "primary",
        prominence: 2,
        component: "status-banner",
      },
      {
        when: { openState: ["closed"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
        component: "status-banner",
      },
    ],
    fetch: async (ctx) => scheduleData(ctx.now),
  },
  {
    id: "location",
    shape: "geo",
    label: "Find us",
    tags: ["directions", "map", "address"],
    what: "Address, map and directions to the restaurant, with a call button",
    freshness: "static",
    access: "public",
    fields: {},
    default: {
      include: true,
      salience: "standard",
      region: "secondary",
      prominence: 1,
      component: "map-card",
    },
    heuristics: [
      {
        when: { visitor: ["nearby"] },
        salience: "standard",
        region: "primary",
        prominence: 1,
        component: "directions-bar",
      },
      {
        when: { arrival: ["transactional"] },
        salience: "featured",
        region: "hero",
        prominence: 2,
        component: "directions-bar",
      },
      {
        when: { openState: ["closed"] },
        salience: "minor",
        region: "secondary",
        prominence: 0,
        component: "map-card",
      },
      { when: { familiarity: ["regular"] }, relevant: false },
    ],
    fetch: async (ctx) => {
      const km = ctx.visitorGeo ? distanceKm(ctx.visitorGeo, VENUE.location) : undefined;
      const distanceText =
        km === undefined
          ? undefined
          : km < 2.5
            ? `${Math.max(1, Math.round(km * 12.5))} min walk`
            : km < 50
              ? `${km.toFixed(1)} km away`
              : undefined;
      return {
        name: VENUE.name,
        address: VENUE.address,
        neighbourhood: VENUE.neighbourhood,
        phone: VENUE.phone,
        lat: VENUE.location.lat,
        lng: VENUE.location.lng,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${VENUE.location.lat},${VENUE.location.lng}`,
        ...(distanceText ? { distanceText } : {}),
      };
    },
  },
  {
    id: "events",
    shape: "list",
    label: "Coming up",
    eyebrow: "Events",
    tags: ["events", "music", "wine"],
    what: "Upcoming events: live music, wine nights and Sunday paella",
    not_for: "Everyday menu or hours",
    freshness: "weekly",
    access: "public",
    fields: { title: owner("title"), date: owner("when"), subtitle: owner("detail") },
    default: {
      include: true,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "events-timeline",
    },
    heuristics: [
      {
        when: { familiarity: ["returning", "regular"] },
        salience: "standard",
        region: "primary",
        prominence: 1,
      },
      { when: { openState: ["closed"] }, salience: "standard", region: "primary", prominence: 1 },
      { when: { arrival: ["transactional"] }, relevant: false },
    ],
    fetch: async (ctx) =>
      EVENTS.map((e) => ({
        title: es(ctx) ? e.title_es : e.title_en,
        when: e.when,
        detail: es(ctx) ? e.detail_es : e.detail_en,
      })),
  },
  {
    id: "reviews",
    shape: "list",
    label: "What guests say",
    eyebrow: "Reviews",
    tags: ["reviews", "ratings"],
    what: "Short quotes from guest reviews with star ratings",
    not_for: "Visitors with arrival transactional, who want directions",
    freshness: "daily",
    access: "public",
    fields: {
      body: thirdParty("text"),
      rating: thirdParty("stars"),
      author: thirdParty("author"),
      date: thirdParty("date"),
    },
    default: {
      include: true,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "review-highlights",
    },
    heuristics: [
      { when: { arrival: ["evaluating"] }, salience: "featured", region: "primary", prominence: 2 },
      { when: { visitor: ["tourist"] }, salience: "standard", region: "secondary", prominence: 1 },
      { when: { familiarity: ["regular"] }, relevant: false },
      { when: { arrival: ["transactional"] }, relevant: false },
    ],
    // Reviews are third-party: filter out the steering attempt in code, not by asking a model.
    fetch: async () => REVIEWS.filter((r) => r.author !== "anon"),
  },
  {
    id: "whats-new",
    shape: "record",
    label: "What's new",
    tags: ["news", "announcement"],
    what: "This week's announcement; the first thing a regular or returning guest should see",
    not_for: "Visitors whose familiarity is new or unknown",
    freshness: "weekly",
    access: "public",
    fields: {
      title: owner("title"),
      body: owner("body"),
      image: owner("image"),
      imageAlt: owner("alt"),
    },
    default: {
      include: false,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "record-card",
    },
    heuristics: [
      {
        when: { familiarity: ["returning"] },
        relevant: true,
        salience: "standard",
        region: "primary",
        prominence: 1,
      },
      {
        when: { familiarity: ["regular"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
      },
      { when: { openState: ["closed"] }, region: "primary", prominence: 1 },
    ],
    fetch: async (ctx) => ({
      title: es(ctx) ? WHATS_NEW.title_es : WHATS_NEW.title_en,
      body: es(ctx) ? WHATS_NEW.body_es : WHATS_NEW.body_en,
      image: WHATS_NEW.image,
      alt: WHATS_NEW.alt,
    }),
  },
];

export const manifests = defineManifests({
  site: "casa-lumbre",
  sources,
  components: libraryManifests,
});
