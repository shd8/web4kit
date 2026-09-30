import type { ContextEnvelope } from "@web4kit/context";
import { defineManifests, defineSource } from "@web4kit/manifest";
import { describe, expect, it } from "vitest";
import {
  calibrateEntry,
  grid,
  invariant,
  label,
  labelsFrom,
  manifestInvariants,
  type Observation,
  situate,
} from "./index";

const obs = (conf: number, correct: boolean): Observation => ({
  kind: "C.region",
  language: "english",
  confidence: conf,
  correct,
});

describe("calibration thresholds (task 11.3)", () => {
  it("finds a threshold for a separable kind", () => {
    const data = [
      ...Array.from({ length: 40 }, (_, i) => obs(0.6 + (i % 10) * 0.04, true)),
      ...Array.from({ length: 10 }, (_, i) => obs(0.1 + i * 0.03, false)),
    ];
    const entry = calibrateEntry(data, undefined)!;
    expect(entry.uncalibrated).toBe(false);
    expect(entry.acceptThreshold).toBeGreaterThan(0.3); // admits at most 5% accepted errors (2 of 42)
    expect(entry.acceptThreshold).toBeLessThanOrEqual(0.6);
    expect(entry.accuracy).toBeCloseTo(0.8, 5);
  });

  it("marks silent failure (wrong answers as confident as right ones) uncalibrated", () => {
    const data = Array.from({ length: 60 }, (_, i) => obs(0.9 + (i % 5) * 0.02, i % 2 === 0));
    const entry = calibrateEntry(data, undefined)!;
    expect(entry.uncalibrated).toBe(true);
    expect(entry.overlap).toBeGreaterThan(0.4);
  });

  it("omits entries with too few samples", () => {
    expect(calibrateEntry([obs(0.9, true), obs(0.8, true)], undefined)).toBeUndefined();
  });

  it("adds a margin when answers flip between repeats", () => {
    const data = [
      ...Array.from({ length: 40 }, () => obs(0.8, true)),
      ...Array.from({ length: 10 }, () => obs(0.3, false)),
    ];
    const stable = calibrateEntry(data, 0)!;
    const jittery = calibrateEntry(data, 0.2)!;
    expect(jittery.acceptThreshold).toBeCloseTo(stable.acceptThreshold + 0.05, 5);
    expect(jittery.flipRate).toBe(0.2);
  });
});

describe("v1 builders (tasks 5.1-5.2)", () => {
  const base: ContextEnvelope = {
    utm: {},
    languages: [],
    device: "mobile",
    saveData: false,
    consent: false,
    now: "2026-10-02T08:00:00Z",
  };

  it("labels use names, conditional entries are dropped", () => {
    const labels = labelsFrom((s) => [
      label.relevant("rooms", s.stay === "none"),
      s.stay === "booked" && label.relevant("breakfast"),
      label.salience("rooms", "featured", "standard"),
      label.prominence("rooms", "prominent", 1),
      label.region("rooms", "primary"),
    ]);
    expect(labels({ stay: "none" })).toEqual([
      { kind: "A.relevance", source: "rooms", accept: [true] },
      { kind: "A.salience", source: "rooms", accept: [3, 2] },
      { kind: "C.prominence", source: "rooms", accept: [2, 1] },
      { kind: "C.region", source: "rooms", accept: ["primary"] },
    ]);
    expect(labels({ stay: "booked" })).toHaveLength(5);
  });

  it("grid names fixtures axis=label in cross-product order", () => {
    const fixtures = grid({
      base,
      axes: {
        stay: { none: {}, booked: { firstParty: { arrival: "2026-10-01" } } },
        time: { morning: {}, evening: (e) => ({ ...e, now: "2026-10-02T19:00:00Z" }) },
      },
    });
    expect(fixtures.map((f) => f.name)).toEqual([
      "stay=none,time=morning",
      "stay=none,time=evening",
      "stay=booked,time=morning",
      "stay=booked,time=evening",
    ]);
    expect(fixtures[3]!.envelope).toMatchObject({
      firstParty: { arrival: "2026-10-01" },
      now: "2026-10-02T19:00:00Z",
    });
    expect(grid({ base, axes: { a: { x: {}, y: {}, z: {} } }, limit: 2 })).toHaveLength(2);
  });

  it("situate derives situations and adds manifest invariants and labels", () => {
    const manifests = defineManifests({
      site: "t",
      components: [
        {
          id: "rows",
          what: "Rows",
          accepts: [{ shape: "list" }],
          affordances: ["browse"],
          footprint: Object.fromEntries(
            ["mobile", "tablet", "desktop"].map((d) => [d, { colSpan: 12, rowSpan: 2 }]),
          ) as never,
          mediaHeavy: false,
        },
      ],
      sources: [
        defineSource({
          id: "rooms",
          shape: "list",
          label: "Rooms",
          what: "Rooms",
          mustExclude: { stay: ["booked"] },
          fetch: async () => [],
        }),
        defineSource({
          id: "arrival",
          shape: "list",
          label: "Arrival",
          what: "Arrival",
          mustInclude: { stay: ["booked"] },
          fetch: async () => [],
        }),
      ],
    });
    const situationOf = (e: ContextEnvelope) => ({ stay: e.firstParty ? "booked" : "none" });
    expect(manifestInvariants(manifests, { stay: "booked" })).toEqual([
      invariant.absent("rooms"),
      invariant.present("arrival"),
    ]);
    const [none, booked] = situate(
      grid({ base, axes: { stay: { none: {}, booked: { firstParty: { a: "1" } } } } }),
      {
        situationOf,
        manifests,
        invariants: (s) => (s.stay === "booked" ? [invariant.absent("rooms")] : []),
        labels: labelsFrom((s) => [label.relevant("rooms", s.stay === "none")]),
      },
    );
    expect(none!.situation).toEqual({ stay: "none" });
    expect(none!.invariants).toEqual([]);
    expect(booked!.invariants).toEqual([invariant.absent("rooms"), invariant.present("arrival")]);
    expect(booked!.expected).toEqual([label.relevant("rooms", false)]);
  });
});
