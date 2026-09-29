import type { Device, Footprint } from "@web4kit/ir";
import { describe, expect, it } from "vitest";
import { type Candidate, solve } from "./index";

const fp = (colSpan: number, rowSpan = 2): Record<Device, Footprint> => ({
  mobile: { colSpan, rowSpan },
  tablet: { colSpan, rowSpan },
  desktop: { colSpan, rowSpan },
});

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  sourceId: id,
  componentId: `${id}-view`,
  propsBinding: {},
  region: "primary",
  prominence: 1,
  salience: 2,
  defaultRank: 10,
  footprint: fp(6),
  mediaHeavy: false,
  why: [],
  ...over,
});

const ids = (blocks: { sourceId: string }[]) => blocks.map((b) => b.sourceId);

describe("region filling (task 7.1)", () => {
  it("keeps one hero and demotes the other, recorded as invariant", () => {
    const { layout } = solve({
      candidates: [
        cand("photos", { region: "hero", prominence: 2 }),
        cand("insta", { region: "hero", prominence: 1.5 }),
      ],
      device: "desktop",
      seed: "s",
      mediaBudget: "high",
    });
    expect(ids(layout.hero)).toEqual(["photos"]);
    expect(ids(layout.primary)).toEqual(["insta"]);
    const why = layout.primary[0]!.why.at(-1)!;
    expect(why).toMatchObject({
      decidedBy: "invariant",
      question: "invariant.hero-capacity",
      answer: "primary",
    });
  });

  it("orders by prominence, then salience, then default rank", () => {
    const { layout } = solve({
      candidates: [
        cand("a", { prominence: 1, salience: 1 }),
        cand("b", { prominence: 2 }),
        cand("c", { prominence: 1, salience: 3 }),
        cand("d", { prominence: 1, salience: 1, defaultRank: 1 }),
      ],
      device: "desktop",
      seed: "s",
      mediaBudget: "high",
    });
    expect(ids(layout.primary)).toEqual(["b", "c", "d", "a"]);
  });

  it("overflows down the chain when regions are full", () => {
    const { layout, dropped } = solve({
      candidates: ["a", "b", "c"].map((id, i) => cand(id, { prominence: 2 - i })),
      device: "desktop",
      seed: "s",
      mediaBudget: "high",
      capacities: { primary: 1, secondary: 1, footer: 0 },
    });
    expect(ids(layout.primary)).toEqual(["a"]);
    expect(ids(layout.secondary)).toEqual(["b"]);
    expect(dropped.map((d) => d.sourceId)).toEqual(["c"]);
  });
});

describe("invariants (task 7.2)", () => {
  it("renders each source with exactly one component", () => {
    const { layout } = solve({
      candidates: [cand("menu"), cand("menu", { componentId: "other" })],
      device: "desktop",
      seed: "s",
      mediaBudget: "high",
    });
    expect(layout.primary).toHaveLength(1);
  });

  it("replaces media-heavy components with their fallback on a low media budget", () => {
    const { layout } = solve({
      candidates: [
        cand("photos", {
          componentId: "hero-carousel",
          mediaHeavy: true,
          fallback: { componentId: "photo-list", footprint: fp(12, 1) },
        }),
      ],
      device: "mobile",
      seed: "s",
      mediaBudget: "low",
    });
    expect(layout.primary[0]).toMatchObject({ componentId: "photo-list" });
    expect(layout.primary[0]!.why.at(-1)).toMatchObject({ question: "invariant.media-budget" });
  });
});

describe("per-device grid templates (task 7.3)", () => {
  const candidates = () => [
    cand("hero", { region: "hero", prominence: 2, footprint: fp(8, 3) }),
    cand("menu", { footprint: fp(8) }),
    cand("map", { region: "aside", footprint: fp(4, 1) }),
    cand("reviews", { region: "secondary", footprint: fp(6) }),
  ];
  for (const device of ["mobile", "tablet", "desktop"] as const) {
    it(`matches the ${device} snapshot`, () => {
      const { layout } = solve({
        candidates: candidates(),
        device,
        seed: "s",
        mediaBudget: "high",
      });
      const summary = Object.fromEntries(
        Object.entries(layout).map(([r, blocks]) => [
          r,
          blocks.map((b) => `${b.sourceId}:${b.footprint.colSpan}x${b.footprint.rowSpan}`),
        ]),
      );
      expect(summary).toMatchSnapshot();
    });
  }
});

describe("seeded tie-breaking (task 7.4)", () => {
  it("keeps equal blocks in the same order across 100 re-plans", () => {
    const make = () => ["m", "k", "x", "a", "q"].map((id) => cand(id));
    const first = ids(
      solve({
        candidates: make(),
        device: "desktop",
        seed: "situation-1",
        mediaBudget: "high",
        capacities: { primary: 10 },
      }).layout.primary,
    );
    for (let i = 0; i < 100; i++) {
      const shuffled = make().sort(() => Math.random() - 0.5);
      const again = ids(
        solve({
          candidates: shuffled,
          device: "desktop",
          seed: "situation-1",
          mediaBudget: "high",
          capacities: { primary: 10 },
        }).layout.primary,
      );
      expect(again).toEqual(first);
    }
  });
});
