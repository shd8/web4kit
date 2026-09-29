import { type ContextEnvelope, distanceKm, localClock, pointAtDistance } from "@web4kit/context";

/** Lab controls read from and write to a Context Envelope, so presets and controls share one state. */

export const ARRIVALS = [
  { id: "instagram", label: "Instagram" },
  { id: "maps", label: "Google Maps" },
  { id: "tripadvisor", label: "Tripadvisor" },
  { id: "direct", label: "Direct" },
] as const;
export type ArrivalId = (typeof ARRIVALS)[number]["id"];

const MAPS_REF = "https://www.google.com/maps/place/Casa+Lumbre";
const TRIP_REF = "https://www.tripadvisor.com/Restaurant_Review";

export function getArrival(e: ContextEnvelope): ArrivalId {
  if (e.src === "instagram") return "instagram";
  if (e.referrer?.includes("/maps")) return "maps";
  if (e.referrer?.includes("tripadvisor")) return "tripadvisor";
  return "direct";
}
export function setArrival(e: ContextEnvelope, id: ArrivalId): ContextEnvelope {
  const { src: _s, referrer: _r, ...rest } = e;
  if (id === "instagram") return { ...rest, src: "instagram" };
  if (id === "maps") return { ...rest, referrer: MAPS_REF };
  if (id === "tripadvisor") return { ...rest, referrer: TRIP_REF };
  return rest;
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Venue-local clock of the envelope. */
export function getClock(e: ContextEnvelope, timeZone: string) {
  return localClock(new Date(e.now), timeZone);
}

/** Set venue-local weekday and minutes, keeping the week of the envelope. */
export function setClock(
  e: ContextEnvelope,
  timeZone: string,
  day: number,
  minutes: number,
): ContextEnvelope {
  const current = new Date(e.now);
  const clock = localClock(current, timeZone);
  const deltaMinutes = (day - clock.day) * 1440 + (minutes - clock.minutes);
  return { ...e, now: new Date(current.getTime() + deltaMinutes * 60_000).toISOString() };
}

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Distance uses a log scale: slider 0..100 -> 0.1 km .. 2000 km
const MIN_KM = 0.1;
const MAX_KM = 2000;
export const kmToSlider = (km: number) =>
  Math.round((Math.log(km / MIN_KM) / Math.log(MAX_KM / MIN_KM)) * 100);
export const sliderToKm = (v: number) => MIN_KM * (MAX_KM / MIN_KM) ** (v / 100);

export function getDistance(
  e: ContextEnvelope,
  venue: { lat: number; lng: number },
): number | undefined {
  return e.geo ? distanceKm(e.geo, venue) : undefined;
}
export function setDistance(
  e: ContextEnvelope,
  venue: { lat: number; lng: number },
  km: number,
): ContextEnvelope {
  return { ...e, geo: pointAtDistance(venue, km) };
}
export function formatKm(km: number | undefined) {
  if (km === undefined) return "unknown";
  return km < 1
    ? `${Math.round(km * 1000)} m`
    : km < 10
      ? `${km.toFixed(1)} km`
      : `${Math.round(km)} km`;
}

export const VISITS = [
  { id: "none", label: "No cookie" },
  { id: "new", label: "1st visit" },
  { id: "returning", label: "Returning" },
  { id: "regular", label: "Regular" },
] as const;
export type VisitsId = (typeof VISITS)[number]["id"];

export function getVisits(e: ContextEnvelope): VisitsId {
  if (!e.consent) return "none";
  const n = e.visit?.count ?? 0;
  return n === 0 ? "new" : n < 5 ? "returning" : "regular";
}
export function setVisits(e: ContextEnvelope, id: VisitsId): ContextEnvelope {
  const { visit: _v, ...rest } = e;
  if (id === "none") return { ...rest, consent: false };
  const count = id === "new" ? 0 : id === "returning" ? 2 : 7;
  return { ...rest, consent: true, visit: { count } };
}

export const LANGUAGES = [
  { tag: "en-GB", label: "English" },
  { tag: "es-ES", label: "Español" },
  { tag: "de-DE", label: "Deutsch" },
  { tag: "fr-FR", label: "Français" },
] as const;

export const DEVICES = ["mobile", "tablet", "desktop"] as const;
export const ROLES = [
  { id: "ops-manager", label: "Ops manager" },
  { id: "analyst", label: "Analyst" },
  { id: "executive", label: "Executive" },
] as const;
