import { situationHash } from "@web4kit/context";
import { describe, expect, it } from "vitest";
import { combinations, comboCount } from "./grid";
import { GRIDS } from "./grids";

describe("playground control grids (launch-site 1.2)", () => {
  for (const grid of Object.values(GRIDS)) {
    describe(grid.site, () => {
      it("every persona preset derives the persona's own situation", () => {
        for (const p of grid.personas) {
          for (const c of grid.controls)
            expect(
              c.options.map((o) => o.value),
              `${p.name}.${c.id}`,
            ).toContain(p.values[c.id]);
          expect(grid.situationOf(grid.envelope(p.values)), p.name).toEqual(
            grid.situationOf(p.envelope),
          );
        }
      });

      it("counts combinations and distinct situations", () => {
        const hashes = new Set<string>();
        let n = 0;
        for (const values of combinations(grid.controls)) {
          hashes.add(situationHash(grid.situationOf(grid.envelope(values))));
          n++;
        }
        expect(n).toBe(comboCount(grid.controls));
        console.log(`${grid.site}: ${n} combinations, ${hashes.size} distinct situations`);
        expect(hashes.size).toBeGreaterThan(grid.personas.length);
      }, 120_000);
    });
  }
});
