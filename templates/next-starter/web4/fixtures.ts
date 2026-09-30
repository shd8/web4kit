import {
  type Fixture,
  grid,
  invariant,
  invariantsFrom,
  label,
  labelsFrom,
  type SituatedFixture,
  situate,
} from "@web4kit/conformance";
import { type ContextEnvelope, pointAtDistance } from "@web4kit/context";
import { HOTEL } from "./hotel";
import { manifests } from "./manifests";
import { situationOf } from "./situation";

// 2026-10-02 is a Friday; Porto is UTC+1 in October (WEST).
const at = (date: string, hhmmUtc: string) => `${date}T${hhmmUtc}:00Z`;
const envelope = (
  over: Partial<ContextEnvelope> & Pick<ContextEnvelope, "now">,
): ContextEnvelope => ({
  utm: {},
  languages: ["en-GB"],
  device: "mobile",
  saveData: false,
  consent: false,
  ...over,
});
const booking = (arrival: string, nights = 3) => ({
  firstParty: { arrival, nights: String(nights) },
});

/** The five personas shown by `?as=` in development and used as calibration anchors. */
export const PERSONAS: Fixture[] = [
  {
    name: "dreamer-instagram",
    title: "Dreaming · from Instagram · evening",
    envelope: envelope({
      src: "instagram",
      geo: pointAtDistance(HOTEL.location, 1450),
      now: at("2026-10-02", "19:30"),
    }),
    invariants: [
      { type: "hero", sources: ["hero-photos"] },
      { type: "present", source: "rooms" },
      { type: "absent", source: "arrival-guide" },
      { type: "absent", source: "today" },
    ],
  },
  {
    name: "comparing-booking",
    title: "Comparing · from Booking.com · desktop",
    envelope: envelope({
      referrer: "https://www.booking.com/hotel/pt/casa-ribeira.html",
      device: "desktop",
      geo: pointAtDistance(HOTEL.location, 1800),
      now: at("2026-10-02", "10:00"),
    }),
    invariants: [
      { type: "present", source: "reviews" },
      { type: "present", source: "offer" },
      { type: "present", source: "rooms" },
      { type: "absent", source: "breakfast" },
    ],
  },
  {
    name: "arriving-today",
    title: "Arriving today · 13:00 · nearby",
    envelope: envelope({
      ...booking("2026-10-02"),
      geo: pointAtDistance(HOTEL.location, 1.5),
      now: at("2026-10-02", "12:00"),
    }),
    invariants: [
      { type: "present", source: "arrival-guide" },
      { type: "present", source: "check-in" },
      { type: "present", source: "getting-here" },
      { type: "absent", source: "rooms" },
      { type: "absent", source: "reviews" },
    ],
  },
  {
    name: "in-house-morning",
    title: "Staying · day 2 · 08:30",
    envelope: envelope({
      ...booking("2026-10-01"),
      geo: pointAtDistance(HOTEL.location, 0.05),
      now: at("2026-10-02", "07:30"),
    }),
    invariants: [
      { type: "hero", sources: ["today"] },
      { type: "present", source: "breakfast" },
      { type: "absent", source: "rooms" },
      { type: "absent", source: "offer" },
    ],
  },
  {
    name: "in-house-rainy-evening",
    title: "Staying · rainy evening · 20:00",
    envelope: envelope({
      ...booking("2026-10-03"),
      geo: pointAtDistance(HOTEL.location, 0.05),
      now: at("2026-10-04", "19:00"),
    }),
    invariants: [
      { type: "present", source: "events" },
      { type: "present", source: "today" },
      { type: "absent", source: "breakfast" },
      { type: "absent", source: "hero-photos" },
    ],
  },
];

/**
 * Page invariants that must hold in every situation. `mustInclude` / `mustExclude` in the
 * manifests (check-in and arrival guide for arriving guests, no rooms once here) are added
 * automatically by `situate`.
 */
export const universalInvariants = invariantsFrom((s) => [
  s.stayPhase === "in-house" && invariant.absent("rooms"),
  (s.stayPhase !== "in-house" || s.dayPart !== "morning") && invariant.absent("breakfast"),
]);

/** Clear-cut labels written from the situation, independently of the manifest heuristics. */
export const labelsFor = labelsFrom((s) => {
  const staying = s.stayPhase === "in-house";
  const researching = s.stayPhase === "researching";
  return [
    label.relevant("rooms", researching),
    label.relevant("arrival-guide", s.stayPhase === "arriving-today"),
    label.relevant("today", staying),
    staying && s.dayPart === "morning" && label.relevant("breakfast"),
    !staying && label.relevant("breakfast", false),
    researching && s.arrival === "evaluating" && label.relevant("reviews"),
    staying && label.relevant("reviews", false),
    researching && label.relevant("hero-photos"),
    s.stayPhase === "arriving-today" && label.component("getting-here", "directions-bar"),
    researching && label.component("rooms", "card-grid"),
  ];
});

const onDay = (date: string) => (e: ContextEnvelope) => ({
  ...e,
  now: at(date, e.now.slice(11, 16)),
});
const atTime = (time: string) => (e: ContextEnvelope) => ({
  ...e,
  now: at(e.now.slice(0, 10), time),
});
const TIMES = ["07:30", "12:00", "16:30", "19:00", "22:30"];

/** Every stay phase x day x time x arrival x device, sampled to 100 fixtures. */
export const GRID = grid({
  base: envelope({ geo: pointAtDistance(HOTEL.location, 0.4), now: at("2026-10-02", "12:00") }),
  axes: {
    stay: {
      none: { geo: pointAtDistance(HOTEL.location, 1200) },
      upcoming: booking("2026-10-06"),
      arriving: booking("2026-10-02"),
      staying: booking("2026-10-01", 4),
      left: booking("2026-09-27", 3),
    },
    day: { fri: onDay("2026-10-02"), sat: onDay("2026-10-03"), sun: onDay("2026-10-04") },
    utc: Object.fromEntries(TIMES.map((t) => [t, atTime(t)])),
    arrival: {
      instagram: { src: "instagram" },
      booking: { referrer: "https://www.booking.com/hotel/pt/x.html" },
      maps: { referrer: "https://www.google.com/maps/place/x" },
      direct: {},
    },
    device: { mobile: { device: "mobile" }, desktop: { device: "desktop" } },
  },
  limit: 100,
});

/** Personas plus the grid, situated: situations, invariants and labels attached. */
export function suiteFixtures(): SituatedFixture[] {
  return situate([...PERSONAS, ...GRID], {
    situationOf,
    manifests,
    invariants: universalInvariants,
    labels: labelsFor,
  });
}
