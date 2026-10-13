import { runEngine } from "@web4kit/conformance";
import { createManifestRuleDecider, lintManifests, lintPortability } from "@web4kit/planner";
import { describe, expect, it } from "vitest";
import { suiteFixtures } from "./personas";
import { BUCKETS } from "./situation";
import { manifests } from "./sources";

describe("my web4 site", () => {
  it("tells engines who each time-bound block is for (the lint names the fix)", () => {
    expect(lintManifests(manifests, BUCKETS)).toEqual([]);
  });

  it("fits the portability contract (any Jev-like engine can plan it)", () => {
    expect(lintPortability(manifests, BUCKETS).stateTokens).toBeLessThan(512);
  });

  it("rules pass every invariant (they are the fallback, so they must be a good page)", async () => {
    const run = await runEngine({
      manifests,
      fixtures: suiteFixtures(),
      decider: createManifestRuleDecider(manifests),
    });
    expect(run.invariantFailures).toEqual([]);
  });
});
