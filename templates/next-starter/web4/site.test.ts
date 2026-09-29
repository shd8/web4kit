import { runEngine } from "@web4kit/conformance";
import { createManifestRuleDecider, lintPortability } from "@web4kit/planner";
import { describe, expect, it } from "vitest";
import { PERSONAS, suiteFixtures } from "./fixtures";
import { manifests } from "./manifests";
import { BUCKETS, situationOf } from "./situation";

describe("Casa Ribeira", () => {
  it("fits the portability contract", () => {
    expect(lintPortability(manifests, BUCKETS).stateTokens).toBeLessThan(512);
  });

  it("derives the persona situations", () => {
    const s = Object.fromEntries(PERSONAS.map((p) => [p.name, situationOf(p.envelope)]));
    expect(s["dreamer-instagram"]).toMatchObject({
      stayPhase: "researching",
      arrival: "visual",
      visitor: "tourist",
    });
    expect(s["comparing-booking"]).toMatchObject({
      stayPhase: "researching",
      arrival: "evaluating",
      device: "desktop",
    });
    expect(s["arriving-today"]).toMatchObject({ stayPhase: "arriving-today", visitor: "nearby" });
    expect(s["in-house-morning"]).toMatchObject({ stayPhase: "in-house", dayPart: "morning" });
    expect(s["in-house-rainy-evening"]).toMatchObject({
      stayPhase: "in-house",
      dayPart: "evening",
      weather: "rainy",
    });
  });

  it("rules pass every invariant (the fallback must be a good page)", async () => {
    const run = await runEngine({
      manifests,
      fixtures: suiteFixtures(),
      decider: createManifestRuleDecider(manifests),
    });
    expect(run.invariantFailures).toEqual([]);
  });
});
