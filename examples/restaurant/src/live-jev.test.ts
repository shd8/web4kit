import { resolve } from "node:path";
import { createJevDecider, jevConfigFromEnv, loadDotEnv } from "@web4/decider";
import { allBlocks } from "@web4/ir";
import { createPlanner } from "@web4/planner";
import { describe, expect, it } from "vitest";
import { CORE_FIXTURES, manifests, situationOf } from "./index";

loadDotEnv(resolve(__dirname, "../../../.env"));
const jev = jevConfigFromEnv();
const live = process.env.W4_LIVE === "1" && jev;

/** Live check against hosted Jev (task 10.1). Run with W4_LIVE=1; skipped in CI. */
describe.skipIf(!live)("live Jev (task 10.1)", () => {
  it("plans the restaurant with every answer from jev-1.13.0", async () => {
    const decider = createJevDecider({ apiKey: jev!.apiKey, model: jev!.model });
    const planner = createPlanner({ manifests, decider });
    const { plan, usage, planningMs } = await planner.plan({
      situation: situationOf(CORE_FIXTURES[0]!.envelope),
    });
    expect(plan.engine).toBe("jev-1.13.0");
    const whys = [...allBlocks(plan).flatMap((b) => b.why), ...plan.excluded.flatMap((e) => e.why)];
    const engineAnswered = whys.filter(
      (w) =>
        w.question.startsWith("A.") || w.question.startsWith("B.") || w.question.startsWith("C."),
    );
    expect(engineAnswered.length).toBeGreaterThan(20);
    // No calibration profile yet: every answer is measured (engine version recorded) and gated to rules.
    for (const w of engineAnswered) {
      if (w.decidedBy === "rule" && w.note?.startsWith("uncalibrated"))
        expect(w.engine).toBe("jev-1.13.0");
    }
    console.log(
      `jev plan: ${usage.requests} request(s), ${usage.inputTokens} input tokens, ${Math.round(planningMs)} ms`,
    );
  }, 30_000);
});
