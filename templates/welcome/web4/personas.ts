import {
  type Fixture,
  grid,
  invariant,
  label,
  labelsFrom,
  type SituatedFixture,
  situate,
} from "@web4kit/conformance";
import type { ContextEnvelope } from "@web4kit/context";
import { situationOf } from "./situation";
import { manifests } from "./sources";

const envelope = (over: Partial<ContextEnvelope> = {}): ContextEnvelope => ({
  utm: {},
  languages: ["en-GB"],
  device: "desktop",
  saveData: false,
  consent: false,
  timezone: "Europe/Madrid",
  now: "2026-10-02T14:00:00Z", // 16:00 in Madrid
  ...over,
});

/** Visitors you can preview with `?as=<name>` in development. Also calibration anchors. */
export const PERSONAS: Fixture[] = [
  {
    name: "first-visit",
    title: "First visit · desktop · afternoon",
    envelope: envelope(),
    invariants: [invariant.hero("welcome"), invariant.absent("from-social")],
  },
  {
    name: "from-instagram",
    title: "From Instagram · phone · evening",
    envelope: envelope({ src: "instagram", device: "mobile", now: "2026-10-02T18:30:00Z" }),
    invariants: [invariant.present("from-social"), invariant.present("on-mobile")],
  },
  {
    name: "night-owl",
    title: "Night owl · desktop · 01:30",
    envelope: envelope({ now: "2026-10-02T23:30:00Z" }),
    invariants: [invariant.present("late-night"), invariant.absent("on-mobile")],
  },
];

/** Answers a good designer would agree on, written from the situation. */
export const labelsFor = labelsFrom((s) => [
  label.relevant("get-started"),
  label.relevant("from-social", s.arrival === "visual"),
  label.relevant("on-mobile", s.device === "mobile"),
  label.relevant("late-night", s.dayPart === "night"),
]);

const at = (hhmmUtc: string) => (e: ContextEnvelope) => ({
  ...e,
  now: `2026-10-02T${hhmmUtc}:00Z`,
});

/** Personas plus every arrival x device x time of day. */
export function suiteFixtures(): SituatedFixture[] {
  const variations = grid({
    base: envelope(),
    axes: {
      arrival: {
        instagram: { src: "instagram" },
        google: { referrer: "https://www.google.com/" },
        direct: {},
      },
      device: { mobile: { device: "mobile" }, desktop: {} },
      time: {
        morning: at("07:30"),
        afternoon: at("14:00"),
        evening: at("18:30"),
        night: at("23:30"),
      },
    },
  });
  return situate([...PERSONAS, ...variations], {
    situationOf,
    manifests, // mustInclude / mustExclude become invariants
    invariants: () => [invariant.hero("welcome"), invariant.present("get-started")],
    labels: labelsFor,
  });
}
