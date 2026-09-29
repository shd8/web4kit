import { stableHash } from "@web4kit/ir";
import type { ContextEnvelope, Geo } from "./envelope";

/**
 * A situation is a flat map of bucket -> English label, each label from a closed set.
 * It is the only view of the visitor that deciders ever see (design D4).
 */
export type Situation = Record<string, string>;

export const UNKNOWN = "unknown";

/** Declared closed sets of labels per bucket. "unknown" is always allowed. */
export const CORE_BUCKETS = {
  arrival: ["visual", "transactional", "evaluating", "direct"],
  device: ["mobile", "tablet", "desktop"],
  mediaBudget: ["high", "low"],
  familiarity: ["new", "returning", "regular"],
  language: [] as string[], // open English language names, validated by shape below
} as const;

export const VENUE_BUCKETS = {
  visitor: ["nearby", "local", "tourist"],
  mealWindow: ["breakfast", "lunch", "afternoon", "dinner", "late"],
  openState: ["open", "closing-soon", "closed"],
} as const;

export type BucketSpec = Record<string, readonly string[]>;

/** A pure function from envelope to some bucket labels. All arithmetic lives here. */
export type SituationRule = (envelope: ContextEnvelope) => Situation;

export function deriveSituation(envelope: ContextEnvelope, rules: SituationRule[]): Situation {
  const situation: Situation = {};
  for (const rule of rules) Object.assign(situation, rule(envelope));
  return sortKeys(situation);
}

/** Validate that every label is in its declared closed set (or "unknown"). */
export function assertSituation(situation: Situation, spec: BucketSpec): void {
  for (const [bucket, label] of Object.entries(situation)) {
    const allowed = spec[bucket];
    if (!allowed) throw new Error(`undeclared situation bucket: ${bucket}`);
    if (label === UNKNOWN) continue;
    if (allowed.length === 0 ? !/^[a-z][a-z -]*$/.test(label) : !allowed.includes(label)) {
      throw new Error(`label "${label}" not allowed for bucket ${bucket}`);
    }
  }
}

/** Stable hash: equal situations hash equally, any label change changes the hash. */
export function situationHash(situation: Situation): string {
  const canonical = JSON.stringify(sortKeys(situation));
  return stableHash(canonical);
}

function sortKeys(s: Situation): Situation {
  return Object.fromEntries(Object.entries(s).sort(([a], [b]) => a.localeCompare(b)));
}

// ---------------------------------------------------------------------------------------------
// Core rules (any site)
// ---------------------------------------------------------------------------------------------

const VISUAL = /instagram|^ig$|tiktok|pinterest|facebook|^fb$|threads/;
const TRANSACTIONAL = /maps|waze|citymapper|uber/;
const EVALUATING = /tripadvisor|yelp|thefork|opentable|google|bing|duckduckgo|michelin/;

export const arrivalRule: SituationRule = (env) => {
  const source = env.src ?? env.utm.utm_source;
  if (source) {
    if (VISUAL.test(source)) return { arrival: "visual" };
    if (TRANSACTIONAL.test(source)) return { arrival: "transactional" };
    if (EVALUATING.test(source)) return { arrival: "evaluating" };
  }
  if (env.referrer) {
    let host = "";
    let path = "";
    try {
      const url = new URL(env.referrer);
      host = url.hostname.replace(/^www\./, "");
      path = url.pathname;
    } catch {
      return { arrival: "direct" };
    }
    if (VISUAL.test(host)) return { arrival: "visual" };
    if (TRANSACTIONAL.test(host) || (host.startsWith("google.") && path.startsWith("/maps"))) {
      return { arrival: "transactional" };
    }
    if (EVALUATING.test(host)) return { arrival: "evaluating" };
  }
  return { arrival: "direct" };
};

export const deviceRule: SituationRule = (env) => ({
  device: env.device === "unknown" ? UNKNOWN : env.device,
});

export const mediaBudgetRule: SituationRule = (env) => ({
  mediaBudget: env.saveData ? "low" : "high",
});

export const familiarityRule: SituationRule = (env) => {
  if (!env.consent || !env.visit) return { familiarity: env.consent ? "new" : UNKNOWN };
  const previous = env.visit.count;
  return { familiarity: previous === 0 ? "new" : previous < 5 ? "returning" : "regular" };
};

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
export const languageRule: SituationRule = (env) => {
  const tag = env.languages[0];
  if (!tag) return { language: UNKNOWN };
  try {
    const base = new Intl.Locale(tag).language;
    return { language: (languageNames.of(base) ?? UNKNOWN).toLowerCase() };
  } catch {
    return { language: UNKNOWN };
  }
};

export const CORE_RULES: SituationRule[] = [
  arrivalRule,
  deviceRule,
  mediaBudgetRule,
  familiarityRule,
  languageRule,
];

// ---------------------------------------------------------------------------------------------
// Venue rules (physical places with opening hours)
// ---------------------------------------------------------------------------------------------

export interface OpeningInterval {
  /** 0 = Sunday ... 6 = Saturday */
  day: number;
  /** "HH:MM" venue local time; close may be past midnight, e.g. "01:00" means next day. */
  open: string;
  close: string;
}

export interface VenueConfig {
  location: { lat: number; lng: number };
  timezone: string;
  hours: OpeningInterval[];
  nearbyKm?: number;
  localKm?: number;
  closingSoonMinutes?: number;
}

export function venueRules(venue: VenueConfig): SituationRule[] {
  const nearbyKm = venue.nearbyKm ?? 3;
  const localKm = venue.localKm ?? 50;
  const closingSoon = venue.closingSoonMinutes ?? 45;

  const visitorRule: SituationRule = (env) => {
    if (!env.geo) return { visitor: UNKNOWN };
    const km = distanceKm(env.geo, venue.location);
    return { visitor: km < nearbyKm ? "nearby" : km < localKm ? "local" : "tourist" };
  };

  const timeRules: SituationRule = (env) => {
    const local = localClock(new Date(env.now), venue.timezone);
    return {
      mealWindow: mealWindow(local.minutes),
      openState: openState(local, venue.hours, closingSoon),
    };
  };

  return [visitorRule, timeRules];
}

export function distanceKm(a: Pick<Geo, "lat" | "lng">, b: Pick<Geo, "lat" | "lng">): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** A point at `km` north of `origin`, used by the lab distance control. */
export function pointAtDistance(origin: { lat: number; lng: number }, km: number) {
  return { lat: origin.lat + km / 111.32, lng: origin.lng };
}

export interface LocalClock {
  day: number;
  minutes: number;
}

export function localClock(date: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    day: days.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function mealWindow(minutes: number): string {
  const h = minutes / 60;
  if (h >= 7 && h < 11.5) return "breakfast";
  if (h >= 11.5 && h < 16) return "lunch";
  if (h >= 16 && h < 19.5) return "afternoon";
  if (h >= 19.5 && h < 23) return "dinner";
  return "late";
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** open | closing-soon | closed, including intervals that run past midnight. */
export function openState(local: LocalClock, hours: OpeningInterval[], closingSoonMinutes: number) {
  const week = 7 * 1440;
  const now = local.day * 1440 + local.minutes;
  for (const interval of hours) {
    const start = interval.day * 1440 + toMinutes(interval.open);
    let end = interval.day * 1440 + toMinutes(interval.close);
    if (end <= start) end += 1440;
    for (const offset of [0, -week, week]) {
      if (now >= start + offset && now < end + offset) {
        return end + offset - now <= closingSoonMinutes ? "closing-soon" : "open";
      }
    }
  }
  return "closed";
}
