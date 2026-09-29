import type { Fixture } from "@web4kit/conformance";
import { CONSENT_COOKIE, type ContextEnvelope, pointAtDistance } from "@web4kit/context";
import { VENUE } from "./venue";

const IPHONE = "mobile";

const envelope = (
  over: Partial<ContextEnvelope> & Pick<ContextEnvelope, "now">,
): ContextEnvelope => ({
  utm: {},
  languages: ["en-GB"],
  device: IPHONE,
  saveData: false,
  consent: false,
  ...over,
});

/** The four core personas (spec: lab-showcase). 2026-09-29 is a Tuesday; Madrid is UTC+2. */
export const CORE_FIXTURES: Fixture[] = [
  {
    name: "tourist-insta",
    title: "Tourist · from Instagram · 20:30",
    envelope: envelope({
      src: "instagram",
      languages: ["en-US", "en"],
      geo: { ...pointAtDistance(VENUE.location, 900), country: "FR", city: "Paris" },
      now: "2026-09-29T18:30:00Z",
    }),
    invariants: [
      { type: "hero", sources: ["dish-photos", "instagram"] },
      { type: "component", source: "dish-photos", in: ["hero-carousel", "image-grid"] },
      { type: "present", source: "dinner-menu" },
      { type: "absent", source: "lunch-menu" },
      { type: "present", source: "location" },
    ],
  },
  {
    name: "local-maps",
    title: "Nearby · from Google Maps · 13:10",
    envelope: envelope({
      referrer: "https://www.google.com/maps/place/Casa+Lumbre",
      languages: ["es-ES", "es"],
      geo: { ...pointAtDistance(VENUE.location, 1.2), country: "ES", city: "Madrid" },
      now: "2026-09-29T11:10:00Z",
    }),
    invariants: [
      { type: "hero", sources: ["location", "hours", "lunch-menu"] },
      { type: "component", source: "location", in: ["directions-bar", "map-card"] },
      { type: "present", source: "lunch-menu" },
      { type: "above", source: "lunch-menu", below: "dinner-menu" },
      { type: "absent", source: "instagram" },
    ],
  },
  {
    name: "regular-desktop",
    title: "Regular · desktop · 13:30",
    envelope: envelope({
      device: "desktop",
      languages: ["es-ES"],
      geo: { ...pointAtDistance(VENUE.location, 6), country: "ES", city: "Madrid" },
      consent: true,
      visit: { count: 6, lastVisitDay: 20355 },
      now: "2026-09-30T11:30:00Z",
    }),
    invariants: [
      { type: "hero", sources: ["whats-new"] },
      { type: "present", source: "lunch-menu" },
      { type: "present", source: "events" },
    ],
  },
  {
    name: "late-night-closed",
    title: "Late night · closed · 23:40",
    envelope: envelope({
      languages: ["en-GB"],
      geo: { ...pointAtDistance(VENUE.location, 2), country: "ES", city: "Madrid" },
      now: "2026-09-29T21:40:00Z",
    }),
    invariants: [
      { type: "present", source: "hours" },
      { type: "hero", sources: ["hours"] },
      { type: "component", source: "hours", in: ["status-banner", "hours-card"] },
      { type: "absent", source: "lunch-menu" },
    ],
  },
];

export const CONSENT = `${CONSENT_COOKIE}=1`;
