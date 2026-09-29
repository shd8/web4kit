import { checkInvariants } from "@web4kit/conformance";
import { allBlocks } from "@web4kit/ir";
import { buildQuestions, createPlanner, lintPortability } from "@web4kit/planner";
import { describe, expect, it } from "vitest";
import { REVIEWS } from "./data";
import { BUCKETS, CORE_FIXTURES, manifests, situationOf } from "./index";

describe("restaurant manifests (task 9.1)", () => {
  it("validate and pass the portability lint", () => {
    expect(manifests.sources).toHaveLength(9);
    const { stateTokens, questions } = lintPortability(manifests, BUCKETS);
    expect(stateTokens).toBeLessThan(512);
    expect(questions).toBeGreaterThan(40);
  });

  it("never put third-party review text into decider input", () => {
    for (const f of CORE_FIXTURES) {
      const qp = buildQuestions(manifests, situationOf(f.envelope));
      const text = JSON.stringify(qp);
      for (const r of REVIEWS) expect(text).not.toContain(r.text);
      expect(text).not.toContain("instagram.com");
    }
  });
});

describe("core personas on rules (task 9.2)", () => {
  const planner = createPlanner({ manifests });

  it("pass every invariant and produce four distinct plans from the same URL", async () => {
    const signatures = new Set<string>();
    for (const fixture of CORE_FIXTURES) {
      const situation = situationOf(fixture.envelope);
      const { plan } = await planner.plan({ situation });
      const results = checkInvariants(plan, fixture.invariants);
      const failed = results.filter((r) => !r.ok).map((r) => r.detail);
      expect(failed, `${fixture.name}: ${JSON.stringify(situation)}`).toEqual([]);
      signatures.add(JSON.stringify(allBlocks(plan).map((b) => [b.sourceId, b.componentId])));
    }
    expect(signatures.size).toBe(4);
  });

  it("derives the expected situations", () => {
    const s = Object.fromEntries(CORE_FIXTURES.map((f) => [f.name, situationOf(f.envelope)]));
    expect(s["tourist-insta"]).toMatchObject({
      arrival: "visual",
      visitor: "tourist",
      mealWindow: "dinner",
      openState: "open",
    });
    expect(s["local-maps"]).toMatchObject({
      arrival: "transactional",
      visitor: "nearby",
      mealWindow: "lunch",
      language: "spanish",
    });
    expect(s["regular-desktop"]).toMatchObject({
      familiarity: "regular",
      device: "desktop",
      mealWindow: "lunch",
    });
    expect(s["late-night-closed"]).toMatchObject({ openState: "closed", mealWindow: "late" });
  });
});

describe("conformance fixtures (task 11.1)", async () => {
  const { suiteFixtures } = await import("./suite");
  const { runEngine } = await import("@web4kit/conformance");

  it("expands to 164 fixtures with at least 100 labelled cases", () => {
    const fixtures = suiteFixtures();
    expect(fixtures).toHaveLength(164);
    const labelled = fixtures.filter((f) => (f.expected ?? []).length > 0);
    expect(labelled.length).toBeGreaterThanOrEqual(100);
    expect(new Set(fixtures.map((f) => f.name)).size).toBe(164);
  });

  it("rules decider passes 100% of invariants across the suite", async () => {
    const { createManifestRuleDecider } = await import("@web4kit/planner");
    const run = await runEngine({
      manifests,
      fixtures: suiteFixtures(),
      decider: createManifestRuleDecider(manifests),
    });
    expect(run.invariantFailures).toEqual([]);
    expect(run.invariantPassRate).toBe(1);
  });
});
