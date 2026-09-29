import { distanceKm } from "@web4kit/context";
import { type DataSourceManifestInput, defineManifests } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";
import { ARRIVAL_STEPS, BREAKFAST, EVENTS, OFFER, PHOTOS, REVIEWS, ROOMS } from "./data";
import { forecastFor, HOTEL, hotelClock } from "./hotel";

const owner = (path: string) => ({ path, trust: "owner" as const });
const thirdParty = (path: string) => ({ path, trust: "third-party" as const });

/**
 * The manifests are the prompt: `what` / `not_for` name situation labels directly, because
 * System One models read literally. Heuristics make the offline rules engine a good page too.
 */
export const sources: DataSourceManifestInput[] = [
  {
    id: "hero-photos",
    shape: "media-list",
    label: "Casa Ribeira",
    eyebrow: "Boutique hotel · Porto",
    tags: ["photos", "hotel", "inspiration"],
    what: "Photos of the hotel, the rooftop and the river for guests deciding where to stay",
    not_for: "Guests whose stayPhase is in-house or arriving-today",
    freshness: "weekly",
    access: "public",
    fields: {
      image: owner("src"),
      imageAlt: owner("alt"),
      title: owner("title"),
      caption: owner("text"),
    },
    default: {
      include: true,
      salience: "featured",
      region: "hero",
      prominence: 2,
      component: "hero-carousel",
    },
    heuristics: [
      { when: { stayPhase: ["in-house", "arriving-today", "checked-out"] }, relevant: false },
      { when: { mediaBudget: ["low"] }, component: "caption-list" },
    ],
    fetch: async () => PHOTOS,
  },
  {
    id: "rooms",
    shape: "list",
    label: "Rooms",
    eyebrow: "Twelve rooms · four kinds",
    tags: ["rooms", "prices", "booking"],
    what: "The room types with photo, size and nightly price, for guests who have not booked yet",
    not_for:
      "Guests who already booked: stayPhase upcoming, arriving-today, in-house or checked-out",
    freshness: "daily",
    access: "public",
    fields: {
      title: owner("name"),
      subtitle: owner("desc"),
      value: owner("price"),
      image: owner("img"),
      imageAlt: owner("alt"),
      tags: owner("tags"),
      badge: owner("badge"),
    },
    default: {
      include: true,
      salience: "featured",
      region: "primary",
      prominence: 2,
      component: "card-grid",
    },
    heuristics: [
      { when: { stayPhase: ["in-house", "arriving-today", "checked-out"] }, relevant: false },
    ],
    fetch: async () => ROOMS,
  },
  {
    id: "offer",
    shape: "record",
    label: "Book direct",
    tags: ["offer", "booking", "price"],
    what: "A direct-booking offer for guests comparing hotels or prices",
    not_for: "Guests whose stayPhase is not researching",
    freshness: "weekly",
    access: "public",
    fields: {
      title: owner("title"),
      body: owner("body"),
      image: owner("img"),
      imageAlt: owner("alt"),
      badge: owner("badge"),
    },
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "record-card",
    },
    heuristics: [
      { when: { arrival: ["evaluating"] }, salience: "featured", prominence: 2 },
      {
        when: { stayPhase: ["upcoming", "arriving-today", "in-house", "checked-out"] },
        relevant: false,
      },
    ],
    fetch: async () => OFFER,
  },
  {
    id: "reviews",
    shape: "list",
    label: "What guests say",
    eyebrow: "Reviews",
    tags: ["reviews", "ratings"],
    what: "Short quotes from guest reviews with star ratings, for guests still deciding",
    not_for: "Guests whose stayPhase is in-house, arriving-today or upcoming",
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
      {
        when: { stayPhase: ["upcoming", "arriving-today", "in-house", "checked-out"] },
        relevant: false,
      },
    ],
    fetch: async () => REVIEWS,
  },
  {
    id: "arrival-guide",
    shape: "list",
    label: "Your arrival today",
    eyebrow: "Welcome to Porto",
    tags: ["arrival", "check-in", "luggage"],
    what: "Step by step for today's arrival: luggage drop, check-in time, welcome drink",
    not_for: "Guests whose stayPhase is not arriving-today",
    freshness: "daily",
    access: "public",
    fields: { title: owner("title"), date: owner("when"), subtitle: owner("detail") },
    default: {
      include: false,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "events-timeline",
    },
    mustInclude: { stayPhase: ["arriving-today"] },
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
  },
  {
    id: "check-in",
    shape: "schedule",
    label: "Check-in",
    tags: ["check-in", "reception", "hours"],
    what: "Check-in time and whether it is open now, for guests arriving today or soon",
    not_for: "Guests whose stayPhase is researching, in-house or checked-out",
    freshness: "live",
    access: "public",
    fields: {},
    default: {
      include: false,
      salience: "minor",
      region: "aside",
      prominence: 0,
      component: "hours-card",
    },
    // Business rule, not a judgment: an arriving guest always sees check-in.
    mustInclude: { stayPhase: ["arriving-today"] },
    heuristics: [
      {
        when: { stayPhase: ["arriving-today"] },
        relevant: true,
        salience: "featured",
        region: "primary",
        prominence: 2,
        component: "status-banner",
      },
      {
        when: { stayPhase: ["upcoming"] },
        relevant: true,
        salience: "minor",
        region: "aside",
        prominence: 0,
      },
    ],
    fetch: async (ctx) => {
      const { minutes } = hotelClock(ctx.now);
      const open = minutes >= 15 * 60 || minutes < 60;
      return {
        status: open ? "open" : "closed",
        statusText: open
          ? "Check-in is open · reception 24h"
          : `Check-in opens at ${HOTEL.checkIn} · bags welcome now`,
        days: [
          { label: "Check-in", hours: `from ${HOTEL.checkIn}`, today: true },
          { label: "Check-out", hours: `until ${HOTEL.checkOut}`, today: false },
          { label: "Reception", hours: "24 hours", today: false },
        ],
      };
    },
  },
  {
    id: "getting-here",
    shape: "geo",
    label: "Getting here",
    tags: ["directions", "map", "metro"],
    what: "Address and directions to the hotel; guests arriving today need the quickest route and a call",
    not_for: "Guests whose stayPhase is in-house",
    freshness: "static",
    access: "public",
    fields: {},
    default: {
      include: true,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "map-card",
    },
    heuristics: [
      {
        when: { stayPhase: ["arriving-today"] },
        salience: "featured",
        region: "primary",
        prominence: 2,
        component: "directions-bar",
      },
      { when: { stayPhase: ["in-house"] }, relevant: false },
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
  },
  {
    id: "today",
    shape: "record",
    label: "Today at Casa Ribeira",
    tags: ["today", "weather", "plans"],
    what: "Today's short brief for guests already staying (stayPhase in-house): weather and what is on",
    not_for: "Guests whose stayPhase is not in-house",
    freshness: "live",
    access: "public",
    fields: { title: owner("title"), body: owner("body"), badge: owner("badge") },
    default: {
      include: false,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "record-card",
    },
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
  },
  {
    id: "breakfast",
    shape: "list",
    label: "This morning's breakfast",
    eyebrow: "Terrace · until 10:30",
    tags: ["breakfast", "food"],
    what: "This morning's breakfast menu, served on the terrace until 10:30",
    not_for: "Guests whose dayPart is not morning, or whose stayPhase is not in-house",
    freshness: "daily",
    access: "public",
    fields: { title: owner("name"), subtitle: owner("desc"), tags: owner("tags") },
    default: {
      include: false,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "menu-list",
    },
    heuristics: [
      {
        when: { stayPhase: ["in-house"], dayPart: ["morning"] },
        relevant: true,
        salience: "featured",
        prominence: 2,
      },
    ],
    fetch: async () => BREAKFAST,
  },
  {
    id: "events",
    shape: "list",
    label: "Around the hotel",
    eyebrow: "Tonight and this week",
    tags: ["events", "fado", "port wine"],
    what: "Fado nights, port tastings and rooftop sunsets; indoor options when it rains",
    freshness: "daily",
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
  },
];

export const manifests = defineManifests({
  site: "casa-ribeira",
  sources,
  components: libraryManifests,
});
