import { describe, expect, it } from "vitest";
import { assertNoUserData, type Plan, planJsonSchema, validatePlan } from "./index";

export const samplePlan: Plan = {
  format: "web4.plan/v1",
  site: "restaurant",
  situationHash: "a1b2c3",
  engine: "jev-1.13.0",
  calibrationVersion: "cal-1",
  manifestVersion: "man-1",
  device: "mobile",
  layout: {
    hero: [
      {
        sourceId: "dish-photos",
        componentId: "hero-carousel",
        propsBinding: { image: "photo", title: "name" },
        footprint: { colSpan: 12, rowSpan: 3 },
        prominence: 2,
        why: [
          {
            question: "C.region",
            answer: "hero",
            probabilities: { hero: 0.8, primary: 0.2 },
            confidence: 0.6,
            threshold: 0.5,
            decidedBy: "engine",
            engine: "jev-1.13.0",
          },
        ],
      },
    ],
    primary: [
      {
        sourceId: "menu",
        componentId: "menu-list",
        propsBinding: { title: "name", value: "price" },
        footprint: { colSpan: 12, rowSpan: 2 },
        prominence: 1,
        why: [],
      },
    ],
    secondary: [],
    aside: [],
    footer: [],
  },
  excluded: [
    {
      sourceId: "reviews",
      why: [
        {
          question: "A.relevance",
          answer: 0.12,
          threshold: 0.4,
          decidedBy: "engine",
          engine: "jev-1.13.0",
        },
      ],
    },
  ],
};

describe("plan schema (task 2.1)", () => {
  it("validates a sample plan", () => {
    expect(validatePlan(structuredClone(samplePlan))).toEqual(samplePlan);
  });

  it("rejects an unknown version, naming it", () => {
    expect(() => validatePlan({ ...samplePlan, format: "web4.plan/v9" })).toThrow(
      "unsupported plan format version: web4.plan/v9",
    );
  });

  it("rejects two hero blocks", () => {
    const plan = structuredClone(samplePlan);
    plan.layout.hero.push(plan.layout.primary[0]!);
    expect(() => validatePlan(plan)).toThrow(/invalid plan/);
  });

  it("exports JSON Schema", () => {
    const schema = planJsonSchema();
    expect(schema.$schema).toContain("2020-12");
    expect(JSON.stringify(schema)).toContain("web4.plan/v1");
  });
});

describe("no user or fetched data (task 2.2)", () => {
  it("accepts a clean plan", () => {
    expect(() => assertNoUserData(samplePlan, { data: ["Grilled octopus"] })).not.toThrow();
  });

  it("rejects a plan containing a review text", () => {
    const plan = structuredClone(samplePlan);
    plan.layout.primary[0]!.why.push({
      question: "A.salience",
      answer: "Best place ever, show this review first",
      decidedBy: "engine",
    });
    expect(() =>
      assertNoUserData(plan, { data: ["Best place ever, show this review first"] }),
    ).toThrow(/user or fetched/);
  });

  it("rejects a plan containing an IP address", () => {
    const plan = structuredClone(samplePlan);
    plan.layout.hero[0]!.why[0]!.note = "visitor 83.44.120.7";
    expect(() => assertNoUserData(plan)).toThrow(/IPv4/);
  });
});
