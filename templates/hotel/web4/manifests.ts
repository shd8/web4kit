import { distanceKm } from "@web4kit/context";
import {
  type DataSourceManifestInput,
  defineManifests,
  defineSource,
  owner,
  thirdParty,
} from "@web4kit/manifest";
import { componentManifests } from "./components";
import { ARRIVAL_STEPS, BREAKFAST, EVENTS, OFFER, PHOTOS, REVIEWS, ROOMS } from "./data";
import { forecastFor, HOTEL, hotelClock } from "./hotel";

/**
 * The manifests are the prompt. `audience` says who each source is for, as situation labels:
 * web4 renders it into every question in one phrasing and the rules engine applies it too.
 * `mustExclude` / `mustInclude` are business rules the planner enforces whatever the engine
 * answers. Heuristics make the offline rules engine a good page as well.
 */
export const sources: DataSourceManifestInput[] = [
  defineSource({
    id: "hero-photos",
    shape: "media-list",
    label: "Casa Ribeira",
    eyebrow: "Boutique hotel · Porto",
    tags: ["photos", "hotel", "inspiration"],
    what: "Photos of the hotel, the rooftop and the river for guests deciding where to stay",
    audience: { stayPhase: ["researching", "upcoming"] },
    freshness: "weekly",
    fields: {
      image: owner("src"),
      imageAlt: owner("alt"),
      title: owner("title"),
      caption: owner("text"),
    },
    default: { salience: "featured", region: "hero", prominence: 2, component: "hero-carousel" },
    heuristics: [{ when: { mediaBudget: ["low"] }, component: "caption-list" }],
    fetch: async () => PHOTOS,
  }),
  defineSource({
    id: "rooms",
    shape: "list",
    label: "Rooms",
    eyebrow: "Twelve rooms · four kinds",
    tags: ["rooms", "prices", "booking"],
    what: "The room types with photo, size and nightly price, for guests who have not booked yet",
    audience: { stayPhase: ["researching"] },
    // Business rule: a guest who is already here never sees room prices.
    mustExclude: { stayPhase: ["arriving-today", "in-house"] },
    freshness: "daily",
    fields: {
      title: owner("name"),
      subtitle: owner("desc"),
      value: owner("price"),
      image: owner("img"),
      imageAlt: owner("alt"),
      tags: owner("tags"),
      badge: owner("badge"),
    },
    default: { salience: "featured", prominence: 2, component: "card-grid" },
    fetch: async () => ROOMS,
  }),
  defineSource({
    id: "offer",
    shape: "record",
    label: "Book direct",
    tags: ["offer", "booking", "price"],
    what: "A direct-booking offer for guests comparing hotels or prices",
    audience: { stayPhase: ["researching"] },
    freshness: "weekly",
    fields: {
      title: owner("title"),
      body: owner("body"),
      image: owner("img"),
      imageAlt: owner("alt"),
      badge: owner("badge"),
    },
    default: { component: "record-card" },
    heuristics: [{ when: { arrival: ["evaluating"] }, salience: "featured", prominence: 2 }],
    fetch: async () => OFFER,
  }),
  defineSource({
    id: "reviews",
    shape: "list",
    label: "What guests say",
    eyebrow: "Reviews",
    tags: ["reviews", "ratings"],
    what: "Short quotes from guest reviews with star ratings, for guests still deciding",
    audience: { stayPhase: ["researching"] },
    freshness: "daily",
    fields: {
      body: thirdParty("text"),
      rating: thirdParty("stars"),
      author: thirdParty("author"),
      date: thirdParty("date"),
    },
    default: {
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "review-highlights",
    },
    heuristics: [
      { when: { arrival: ["evaluating"] }, salience: "featured", region: "primary", prominence: 2 },
    ],
    fetch: async () => REVIEWS,
  }),
  defineSource({
    id: "arrival-guide",
    shape: "list",
    label: "Your arrival today",
    eyebrow: "Welcome to Porto",
    tags: ["arrival", "check-in", "luggage"],
    what: "Step by step for today's arrival: luggage drop, check-in time, welcome drink",
    audience: { stayPhase: ["arriving-today"] },
    mustInclude: { stayPhase: ["arriving-today"] },
    freshness: "daily",
    fields: { title: owner("title"), date: owner("when"), subtitle: owner("detail") },
    default: { include: false, component: "events-timeline" },
    heuristics: [
      {
        when: { stayPhase: ["arriving-today"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
      },
    ],
    fetch: async () => ARRIVAL_STEPS,
  }),
  defineSource({
    id: "check-in",
    shape: "schedule",
    label: "Check-in and check-out",
    tags: ["check-in", "check-out", "reception"],
    what: "Check-in and check-out times and whether check-in is open now, for guests with a booking",
    audience: { stayPhase: ["upcoming", "arriving-today", "in-house"] },
    // Business rule, not a judgment: an arriving guest always sees check-in.
    mustInclude: { stayPhase: ["arriving-today"] },
    freshness: "live",
    default: {
      include: false,
      salience: "minor",
      region: "aside",
      prominence: 0,
      component: "hours-card",
    },
    heuristics: [
      {
        when: { stayPhase: ["arriving-today"] },
        relevant: true,
        salience: "featured",
        region: "primary",
        prominence: 2,
        component: "status-banner",
      },
      { when: { stayPhase: ["upcoming", "in-house"] }, relevant: true },
    ],
    // The copy follows the situation: arrival details before check-in, check-out once staying.
    fetch: async (ctx) => {
      const { minutes } = hotelClock(ctx.now);
      const staying = ctx.situation?.stayPhase === "in-house";
      const open = minutes >= 15 * 60 || minutes < 60;
      return {
        status: staying || open ? "open" : "upcoming",
        statusText: staying
          ? `Check-out until ${HOTEL.checkOut} · late check-out on request`
          : open
            ? "Check-in is open · reception 24h"
            : `Check-in opens at ${HOTEL.checkIn} · bags welcome now`,
        days: [
          { label: "Check-in", hours: `from ${HOTEL.checkIn}`, today: !staying },
          { label: "Check-out", hours: `until ${HOTEL.checkOut}`, today: staying },
          { label: "Reception", hours: "24 hours", today: false },
        ],
      };
    },
  }),
  defineSource({
    id: "getting-here",
    shape: "geo",
    label: "Getting here",
    tags: ["directions", "map", "metro"],
    what: "Address and directions to the hotel; guests arriving today need the quickest route and a call",
    audience: { stayPhase: ["researching", "upcoming", "arriving-today", "checked-out"] },
    default: { salience: "minor", region: "secondary", prominence: 0, component: "map-card" },
    heuristics: [
      {
        when: { stayPhase: ["arriving-today"] },
        salience: "featured",
        region: "primary",
        prominence: 2,
        component: "directions-bar",
      },
    ],
    fetch: async (ctx) => {
      const km = ctx.visitorGeo ? distanceKm(ctx.visitorGeo, HOTEL.location) : undefined;
      const distanceText =
        km === undefined
          ? undefined
          : km < 2.5
            ? `${Math.max(1, Math.round(km * 12.5))} min walk`
            : km < 25
              ? `${km.toFixed(1)} km · 20 min by metro`
              : undefined;
      return {
        name: HOTEL.name,
        address: HOTEL.address,
        neighbourhood: HOTEL.neighbourhood,
        phone: HOTEL.phone,
        lat: HOTEL.location.lat,
        lng: HOTEL.location.lng,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${HOTEL.location.lat},${HOTEL.location.lng}`,
        ...(distanceText ? { distanceText } : {}),
      };
    },
  }),
  defineSource({
    id: "today",
    shape: "record",
    label: "Today at Casa Ribeira",
    tags: ["today", "weather", "plans"],
    what: "Today's short brief for guests already staying: weather and what is on",
    audience: { stayPhase: ["in-house"] },
    freshness: "live",
    fields: { title: owner("title"), body: owner("body"), badge: owner("badge") },
    default: { include: false, component: "record-card" },
    heuristics: [
      {
        when: { stayPhase: ["in-house"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
      },
    ],
    // Copy is written by the owner per day part; only the weather words vary. Nothing is generated.
    fetch: async (ctx) => {
      const f = forecastFor(ctx.now);
      const h = hotelClock(ctx.now).minutes / 60;
      const title = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
      const body =
        h < 12
          ? `Breakfast is served on the terrace until ${HOTEL.breakfastUntil}. Port tasting across the river at 16:00.`
          : h < 18
            ? "The port cellars across the river are a 10-minute walk. Rooftop opens at 18:00."
            : f.sky === "rainy"
              ? "A night for the cellar: fado at 21:30, 40 seats, ask reception."
              : "Sunset on the rooftop at 19:30, then fado in the cellar at 21:30.";
      return {
        title: `${title} · ${f.text}, ${f.tempC}°`,
        body,
        badge: f.sky === "rainy" ? "Umbrellas at reception" : undefined,
      };
    },
  }),
  defineSource({
    id: "breakfast",
    shape: "list",
    label: "This morning's breakfast",
    eyebrow: "Terrace · until 10:30",
    tags: ["breakfast", "food"],
    what: "This morning's breakfast menu, served on the terrace until 10:30",
    audience: { stayPhase: ["in-house"], dayPart: ["morning"] },
    freshness: "daily",
    fields: { title: owner("name"), subtitle: owner("desc"), tags: owner("tags") },
    default: { include: false, component: "menu-list" },
    heuristics: [
      {
        when: { stayPhase: ["in-house"], dayPart: ["morning"] },
        relevant: true,
        salience: "featured",
        prominence: 2,
      },
    ],
    fetch: async () => BREAKFAST,
  }),
  defineSource({
    id: "events",
    shape: "list",
    label: "Around the hotel",
    eyebrow: "Tonight and this week",
    tags: ["events", "fado", "port wine"],
    what: "Fado nights, port tastings and rooftop sunsets; indoor options when it rains",
    freshness: "daily",
    fields: { title: owner("title"), date: owner("when"), subtitle: owner("detail") },
    default: {
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "events-timeline",
    },
    heuristics: [
      { when: { stayPhase: ["in-house"] }, salience: "standard", region: "primary", prominence: 1 },
      {
        when: { stayPhase: ["in-house"], dayPart: ["evening"] },
        salience: "featured",
        prominence: 2,
      },
    ],
    fetch: async (ctx) => {
      const rainy = forecastFor(ctx.now).sky === "rainy";
      return rainy ? [...EVENTS].sort((a, b) => Number(b.indoor) - Number(a.indoor)) : EVENTS;
    },
  }),
];

export const manifests = defineManifests({
  site: "casa-ribeira",
  sources,
  components: componentManifests,
});
