import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validatePlan } from "@web4kit/ir";
import { describe, expect, it } from "vitest";

/**
 * Every control combination of every site resolves, in the built site, to a plan and data files
 * that exist (spec: playground, every combination resolves). Runs after `pnpm build`.
 */
const OUT = resolve(import.meta.dirname, "../out/playground");
const built = existsSync(OUT);

describe.skipIf(!built)("every playground combination resolves in out/ (launch-site 4.4)", () => {
  for (const site of ["restaurant", "hotel", "welcome"]) {
    it(site, () => {
      const read = (p: string) => readFileSync(resolve(OUT, site, p), "utf8");
      const index = JSON.parse(read("index.json"));
      const total = index.controls.reduce(
        (n: number, c: { options: unknown[] }) => n * c.options.length,
        1,
      );
      expect(index.entries).toHaveLength(total);
      const plans = new Set<number>();
      const sets = new Set<number>();
      for (const [p, d] of index.entries as Array<[number, number]>) {
        plans.add(p);
        sets.add(d);
      }
      for (const p of plans) validatePlan(JSON.parse(read(`plans/${index.plans[p]}.json`)));
      for (const d of sets)
        for (const hash of Object.values(index.dataSets[d] as Record<string, string>))
          JSON.parse(read(`data/${hash}.json`));
      expect(plans.size).toBe(index.plans.length);
    });
  }
});

if (!built) console.warn("e2e/bundles.test.ts skipped: build the site first (pnpm build)");
