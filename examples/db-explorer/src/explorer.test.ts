import { checkInvariants, runEngine } from "@web4kit/conformance";
import { createEngineDecider, type EngineCall, JEV_CAPABILITIES } from "@web4kit/decider";
import { allBlocks } from "@web4kit/ir";
import {
  type CalibrationProfile,
  calibrationKey,
  createManifestRuleDecider,
  createPlanner,
  KINDS,
  lintPortability,
} from "@web4kit/planner";
import { describe, expect, it } from "vitest";
import { BUCKETS, CORE_FIXTURES, detectLanguage, intentOf, manifests, situationOf } from "./index";
import { suiteFixtures } from "./suite";

describe("explorer dataset and manifests (task 13.1)", () => {
  it("validate and pass the portability lint, including a maximum-length question", () => {
    expect(manifests.sources.map((s) => s.shape)).toEqual(
      expect.arrayContaining(["graph", "list", "timeseries", "record"]),
    );
    expect(lintPortability(manifests, BUCKETS, { withIntent: true }).stateTokens).toBeLessThan(512);
  });
});

describe("role-based planning (task 13.2)", () => {
  it("features late shipments and supplier status for the ops manager", async () => {
    const { plan } = await createPlanner({ manifests }).plan({
      situation: situationOf(CORE_FIXTURES[0]!.envelope),
    });
    const planned = allBlocks(plan).map((b) => b.sourceId);
    expect(planned).toContain("late-shipments");
    expect(planned).toContain("supplier-status");
    expect(checkInvariants(plan, CORE_FIXTURES[0]!.invariants).every((r) => r.ok)).toBe(true);
  });

  it("rules pass every role invariant across the suite", async () => {
    const run = await runEngine({
      manifests,
      fixtures: suiteFixtures(),
      decider: createManifestRuleDecider(manifests),
    });
    expect(run.invariantFailures).toEqual([]);
    expect(suiteFixtures().filter((f) => f.expected?.length).length).toBeGreaterThanOrEqual(100);
  });
});

describe("typed-question intent (task 13.3)", () => {
  it("detects the question language", () => {
    expect(detectLanguage("Which suppliers are late this month?")).toBe("english");
    expect(detectLanguage("¿Qué proveedores llegan tarde este mes?")).toBe("spanish");
    expect(intentOf("x".repeat(400)).text).toHaveLength(280);
  });

  // A fake engine that reads the question: relevant iff a source tag word appears in it.
  const call: EngineCall = async (state, questions) => {
    const request = String((state as Record<string, unknown>).visitor_request ?? "").toLowerCase();
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(questions)) {
      const source = manifests.sources.find((s) => s.id === q.meta?.subject)!;
      const hit = [...source.tags, source.id].some((t) => request.includes(t.replace(/s$/, "")));
      if (q.type === "noul") answers[id] = { noul: hit ? 0.97 : 0.03 };
      else if (q.type === "score")
        answers[id] = {
          score: hit ? 3 : 1,
          probabilities: Object.fromEntries(
            q.criteria.map((_, i) => [
              String(i),
              i === (hit ? Math.min(3, q.criteria.length - 1) : 1) ? 0.97 : 0.01,
            ]),
          ),
        };
      else {
        const opts = Object.keys(q.criteria);
        const pick = opts.includes("primary") ? (hit ? "primary" : "secondary") : opts[0]!;
        answers[id] = {
          choice: pick,
          probabilities: Object.fromEntries(
            opts.map((o) => [o, o === pick ? 0.97 : 0.03 / (opts.length - 1)]),
          ),
        };
      }
    }
    return { answers: answers as never, engineVersion: "fake-reader", inputTokens: 1 };
  };
  const decider = createEngineDecider({ id: "fake-reader", capabilities: JEV_CAPABILITIES, call });
  const profile: CalibrationProfile = {
    engine: "fake-reader",
    version: "cal-x",
    manifestVersion: manifests.version,
    createdAt: "2026-09-29T00:00:00Z",
    entries: Object.fromEntries(
      Object.values(KINDS).map((k) => [
        calibrationKey(k, "english"),
        { acceptThreshold: 0.5, accuracy: 0.9, overlap: 0, sampleSize: 100, uncalibrated: false },
      ]),
    ),
  };

  it("features supplier and shipment sources for 'which suppliers are late this month?'", async () => {
    const f = CORE_FIXTURES.find((x) => x.name === "analyst-late-suppliers")!;
    const { plan } = await createPlanner({ manifests, decider, calibration: profile }).plan({
      situation: situationOf(f.envelope),
      intent: f.intent!,
    });
    const planned = allBlocks(plan).map((b) => b.sourceId);
    expect(planned).toContain("supplier-status");
    expect(planned).toContain("late-shipments");
    expect(planned).not.toContain("top-products");
  });

  it("falls back to role planning for an uncalibrated language, with the reason recorded", async () => {
    const f = CORE_FIXTURES.find((x) => x.name === "analyst-spanish-question")!;
    const { plan } = await createPlanner({ manifests, decider, calibration: profile }).plan({
      situation: situationOf(f.envelope),
      intent: f.intent!,
    });
    expect(checkInvariants(plan, f.invariants).every((r) => r.ok)).toBe(true);
    const why = allBlocks(plan)
      .flatMap((b) => b.why)
      .find((w) => w.question === KINDS.relevance)!;
    expect(why).toMatchObject({ decidedBy: "rule" });
    expect(why.note).toContain("uncalibrated: A.relevance|spanish");
  });
});
