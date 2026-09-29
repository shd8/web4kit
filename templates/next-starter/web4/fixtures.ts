import type { ExpectedAnswer, Fixture, Invariant, SituatedFixture } from "@web4kit/conformance";
import { type ContextEnvelope, pointAtDistance, type Situation } from "@web4kit/context";
import { HOTEL } from "./hotel";
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

/** Page invariants that must hold in every situation. */
export function universalInvariants(s: Situation): Invariant[] {
  const out: Invariant[] = [];
  if (s.stayPhase === "arriving-today") out.push({ type: "present", source: "arrival-guide" });
  if (s.stayPhase === "in-house") out.push({ type: "absent", source: "rooms" });
  if (s.stayPhase !== "in-house" || s.dayPart !== "morning")
    out.push({ type: "absent", source: "breakfast" });
  return out;
}

/** Clear-cut labels written from the situation, independently of the manifest heuristics. */
export function labelsFor(s: Situation): ExpectedAnswer[] {
  const L: ExpectedAnswer[] = [];
  const add = (kind: string, source: string, accept: ExpectedAnswer["accept"]) =>
    L.push({ kind, source, accept });
  const staying = s.stayPhase === "in-house";
  const researching = s.stayPhase === "researching";
  add("A.relevance", "rooms", [researching]);
  add("A.relevance", "arrival-guide", [s.stayPhase === "arriving-today"]);
  add("A.relevance", "today", [staying]);
  if (staying && s.dayPart === "morning") add("A.relevance", "breakfast", [true]);
  if (!staying) add("A.relevance", "breakfast", [false]);
  if (researching && s.arrival === "evaluating") add("A.relevance", "reviews", [true]);
  if (staying) add("A.relevance", "reviews", [false]);
  if (researching) add("A.relevance", "hero-photos", [true]);
  if (s.stayPhase === "arriving-today") add("B.component", "getting-here", ["directions-bar"]);
  if (researching) add("B.component", "rooms", ["card-grid"]);
  return L;
}

const DATES = ["2026-10-02", "2026-10-03", "2026-10-04"];
const TIMES = ["07:30", "12:00", "16:30", "19:00", "22:30"];
const STAYS: Array<Partial<ContextEnvelope>> = [
  {},
  booking("2026-10-06"),
  booking("2026-10-02"),
  booking("2026-10-01", 4),
  booking("2026-09-27", 3),
];
const ARRIVALS: Array<Partial<ContextEnvelope>> = [
  { src: "instagram" },
  { referrer: "https://www.booking.com/hotel/pt/x.html" },
  { referrer: "https://www.google.com/maps/place/x" },
  {},
];

/** Personas plus a deterministic grid over stay phase, time, arrival and device. */
export function suiteFixtures(): SituatedFixture[] {
  const grid: Fixture[] = [];
  for (const [si, stay] of STAYS.entries()) {
    for (const [di, date] of DATES.entries()) {
      for (const [ti, time] of TIMES.entries()) {
        const arrival = ARRIVALS[(si + di + ti) % ARRIVALS.length]!;
        const device = (si + ti) % 2 ? "desktop" : "mobile";
        grid.push({
          name: `stay=${si},date=${date},utc=${time},arr=${(si + di + ti) % ARRIVALS.length},${device}`,
          envelope: envelope({
            ...stay,
            ...arrival,
            device,
            geo: pointAtDistance(HOTEL.location, si === 0 ? 1200 : 0.4),
            now: at(date, time),
          }),
          invariants: [],
        });
      }
    }
  }
  return [...PERSONAS, ...grid].map((f) => {
    const situation = situationOf(f.envelope);
    return {
      ...f,
      situation,
      invariants: [...f.invariants, ...universalInvariants(situation)],
      expected: [...(f.expected ?? []), ...labelsFor(situation)],
    };
  });
}
