import {
  type Axis,
  type ExpectedAnswer,
  expandFixtures,
  type Fixture,
  type Invariant,
  type SituatedFixture,
} from "@web4/conformance";
import { type ContextEnvelope, pointAtDistance, type Situation } from "@web4/context";
import { CORE_FIXTURES } from "./fixtures";
import { situationOf } from "./situation";
import { VENUE } from "./venue";

// 2026-09-29 is a Tuesday; Madrid is UTC+2. Lunch 13-16, dinner 20-23:30.
const at = (hhmmUtc: string) => `2026-09-29T${hhmmUtc}:00Z`;

const AXES: Axis[] = [
  {
    name: "arrival",
    variants: [
      { label: "instagram", apply: (e) => ({ ...e, src: "instagram" }) },
      {
        label: "maps",
        apply: (e) => ({ ...e, referrer: "https://www.google.com/maps/place/Casa+Lumbre" }),
      },
      {
        label: "tripadvisor",
        apply: (e) => ({ ...e, referrer: "https://www.tripadvisor.com/Restaurant_Review" }),
      },
      { label: "direct", apply: (e) => e },
    ],
  },
  {
    name: "time",
    variants: [
      { label: "09:30", apply: (e) => ({ ...e, now: at("07:30") }) },
      { label: "13:10", apply: (e) => ({ ...e, now: at("11:10") }) },
      { label: "17:30", apply: (e) => ({ ...e, now: at("15:30") }) },
      { label: "20:30", apply: (e) => ({ ...e, now: at("18:30") }) },
      { label: "23:10", apply: (e) => ({ ...e, now: at("21:10") }) },
      { label: "23:50", apply: (e) => ({ ...e, now: at("21:50") }) },
    ],
  },
  {
    name: "distance",
    variants: [1.2, 12, 900].map((km) => ({
      label: `${km}km`,
      apply: (e: ContextEnvelope) => ({ ...e, geo: pointAtDistance(VENUE.location, km) }),
    })),
  },
  {
    name: "device",
    variants: [
      { label: "mobile", apply: (e) => ({ ...e, device: "mobile" as const }) },
      { label: "desktop", apply: (e) => ({ ...e, device: "desktop" as const }) },
    ],
  },
  {
    name: "visits",
    variants: [
      { label: "none", apply: (e) => e },
      { label: "returning", apply: (e) => ({ ...e, consent: true, visit: { count: 2 } }) },
      { label: "regular", apply: (e) => ({ ...e, consent: true, visit: { count: 7 } }) },
    ],
  },
  {
    name: "lang",
    variants: [
      { label: "en", apply: (e) => ({ ...e, languages: ["en-GB"] }) },
      { label: "es", apply: (e) => ({ ...e, languages: ["es-ES"] }) },
    ],
  },
];

const BASE: ContextEnvelope = {
  utm: {},
  languages: ["en-GB"],
  device: "mobile",
  saveData: false,
  now: at("18:30"),
  consent: false,
};

/** Page invariants that must hold in every situation. */
export function universalInvariants(s: Situation): Invariant[] {
  const out: Invariant[] = [];
  if (s.openState === "closed" || s.openState === "closing-soon")
    out.push({ type: "present", source: "hours" });
  if (s.openState === "closed" || !["breakfast", "lunch"].includes(s.mealWindow ?? ""))
    out.push({ type: "absent", source: "lunch-menu" });
  if (s.mealWindow === "lunch" && s.openState !== "closed")
    out.push({ type: "present", source: "lunch-menu" });
  return out;
}

/**
 * Hand-written labels: only the clear-cut judgements a restaurant designer would agree on.
 * Written from the situation, independently of the manifest heuristics.
 */
export function labelsFor(s: Situation): ExpectedAnswer[] {
  const L: ExpectedAnswer[] = [];
  const add = (kind: string, source: string, accept: ExpectedAnswer["accept"]) =>
    L.push({ kind, source, accept });
  const open = s.openState !== "closed";

  if (s.mealWindow === "lunch" && open) {
    add("A.relevance", "lunch-menu", [true]);
    add("A.salience", "lunch-menu", [2, 3]);
  }
  if (!open || s.mealWindow === "dinner" || s.mealWindow === "late")
    add("A.relevance", "lunch-menu", [false]);
  if (s.mealWindow === "dinner" && open) {
    add("A.relevance", "dinner-menu", [true]);
    add("A.salience", "dinner-menu", [2, 3]);
  }
  if (!open) {
    add("A.relevance", "hours", [true]);
    add("A.salience", "hours", [2, 3]);
    add("C.region", "hours", ["hero", "primary"]);
  }
  if (s.arrival === "visual") {
    add("A.relevance", "instagram", [true]);
    add("A.relevance", "dish-photos", [true]);
    add("C.region", "dish-photos", ["hero", "primary"]);
    add("B.component", "dish-photos", ["hero-carousel", "image-grid"]);
  }
  if (s.arrival === "evaluating") {
    add("A.relevance", "reviews", [true]);
    add("A.salience", "reviews", [2, 3]);
  }
  if (s.arrival === "transactional") {
    add("A.relevance", "location", [true]);
    add("C.region", "location", ["hero", "primary"]);
    if (s.visitor === "nearby") add("B.component", "location", ["directions-bar"]);
  }
  if (s.visitor === "tourist" && s.arrival !== "transactional")
    add("B.component", "location", ["map-card"]);
  if (s.familiarity === "regular") add("A.relevance", "whats-new", [true]);
  if (s.familiarity === "new" || s.familiarity === "unknown")
    add("A.relevance", "whats-new", [false]);
  return L;
}

/** Core personas plus a deterministic sample of the combinatorial expansion. */
export function suiteFixtures(limit = 160): SituatedFixture[] {
  const expanded: Fixture[] = expandFixtures({ base: BASE, axes: AXES, limit });
  return [...CORE_FIXTURES, ...expanded].map((f) => {
    const situation = situationOf(f.envelope);
    return {
      ...f,
      situation,
      invariants: [...f.invariants, ...universalInvariants(situation)],
      expected: [...(f.expected ?? []), ...labelsFor(situation)],
    };
  });
}
