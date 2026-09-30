import {
  type Axis,
  expandFixtures,
  type Fixture,
  invariant,
  invariantsFrom,
  label,
  labelsFrom,
  type SituatedFixture,
  situate,
} from "@web4kit/conformance";
import { type ContextEnvelope, pointAtDistance } from "@web4kit/context";
import { CORE_FIXTURES } from "./fixtures";
import { manifests } from "./manifests";
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

/**
 * Page invariants that must hold in every situation. The manifest invariants (hours when
 * closed or closing soon, no lunch menu while closed) are added by `situate`.
 */
export const universalInvariants = invariantsFrom((s) => [
  !["breakfast", "lunch"].includes(s.mealWindow ?? "") && invariant.absent("lunch-menu"),
  s.mealWindow === "lunch" && s.openState !== "closed" && invariant.present("lunch-menu"),
]);

/**
 * Hand-written labels: only the clear-cut judgements a restaurant designer would agree on.
 * Written from the situation, independently of the manifest heuristics.
 */
export const labelsFor = labelsFrom((s) => {
  const open = s.openState !== "closed";
  const lunch = s.mealWindow === "lunch" && open;
  const dinner = s.mealWindow === "dinner" && open;
  const visual = s.arrival === "visual";
  const evaluating = s.arrival === "evaluating";
  const transactional = s.arrival === "transactional";
  return [
    lunch && label.relevant("lunch-menu"),
    lunch && label.salience("lunch-menu", "standard", "featured"),
    (!open || s.mealWindow === "dinner" || s.mealWindow === "late") &&
      label.relevant("lunch-menu", false),
    dinner && label.relevant("dinner-menu"),
    dinner && label.salience("dinner-menu", "standard", "featured"),
    !open && label.relevant("hours"),
    !open && label.salience("hours", "standard", "featured"),
    !open && label.region("hours", "hero", "primary"),
    visual && label.relevant("instagram"),
    visual && label.relevant("dish-photos"),
    visual && label.region("dish-photos", "hero", "primary"),
    visual && label.component("dish-photos", "hero-carousel", "image-grid"),
    evaluating && label.relevant("reviews"),
    evaluating && label.salience("reviews", "standard", "featured"),
    transactional && label.relevant("location"),
    transactional && label.region("location", "hero", "primary"),
    transactional && s.visitor === "nearby" && label.component("location", "directions-bar"),
    s.visitor === "tourist" && !transactional && label.component("location", "map-card"),
    s.familiarity === "regular" && label.relevant("whats-new"),
    (s.familiarity === "new" || s.familiarity === "unknown") && label.relevant("whats-new", false),
  ];
});

/** Core personas plus a deterministic sample of the combinatorial expansion. */
export function suiteFixtures(limit = 160): SituatedFixture[] {
  const expanded: Fixture[] = expandFixtures({ base: BASE, axes: AXES, limit });
  return situate([...CORE_FIXTURES, ...expanded], {
    situationOf,
    manifests,
    invariants: universalInvariants,
    labels: labelsFor,
  });
}
