import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The model test needs the cached weights (~1.7 GB). Run with W4_LAYA=1 after the first download.
const cached = existsSync(
  join(process.env.LAYA_CACHE ?? join(homedir(), ".cache", "receptron-laya")),
);
const enabled = process.env.W4_LAYA === "1" && cached;

describe.skipIf(!enabled)("in-process Laya (task 10.3)", () => {
  it("plans the restaurant offline with every answer from the pinned bundle", async () => {
    const { createInProcessLayaDecider } = await import("./index");
    const { createPlanner } = await import("@web4/planner");
    const { allBlocks } = await import("@web4/ir");
    const { CORE_FIXTURES, manifests, situationOf } = await import("@web4/example-restaurant");
    const fetchSpy = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("network disabled in this test"));
    try {
      const decider = await createInProcessLayaDecider();
      const planner = createPlanner({ manifests, decider });
      for (const f of CORE_FIXTURES) {
        const { plan } = await planner.plan({ situation: situationOf(f.envelope) });
        expect(plan.engine).toMatch(/^laya-onnx@/);
        const whys = [
          ...allBlocks(plan).flatMap((b) => b.why),
          ...plan.excluded.flatMap((e) => e.why),
        ];
        expect(whys.some((w) => w.note?.startsWith("engine failed"))).toBe(false);
        expect(whys.filter((w) => w.engine?.startsWith("laya-onnx@")).length).toBeGreaterThan(20);
      }
      await decider.close();
    } finally {
      globalThis.fetch = fetchSpy;
    }
  }, 180_000);
});
