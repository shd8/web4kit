import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEngineDecider, type EngineCall, RULES_CAPABILITIES } from "@web4kit/decider";
import { validatePlan } from "@web4kit/ir";
import { afterAll, describe, expect, it } from "vitest";
import { buildSite } from "./bundle";
import type { Grid } from "./grid";
import { GRIDS } from "./grids";
import { SITES } from "./sites";
import {
  createStoreDecider,
  EngineFailure,
  emptyRecordings,
  loadRecordings,
  saveRecordings,
} from "./store";

const work = mkdtempSync(join(tmpdir(), "w4-precompute-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** A slice of a real grid: the first `keep` options of each control (fast tests, same code). */
const slice = (grid: Grid, keep: Record<string, number>): Grid => ({
  ...grid,
  controls: grid.controls.map((c) => ({ ...c, options: c.options.slice(0, keep[c.id] ?? 1) })),
});
const HOTEL = slice(GRIDS.hotel, { day: 2, time: 6, stay: 5, arrival: 2, distance: 2 });
const WELCOME = GRIDS.welcome;

/** Deterministic fake engine; `failOn` makes that call throw (rate limit). */
function fakeEngine(failOn?: number) {
  let calls = 0;
  const call: EngineCall = async (_state, questions) => {
    calls++;
    if (calls === failOn) throw Object.assign(new Error("429 rate limited"), { status: 429 });
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === "noul") answers[id] = { noul: 0.9 };
      if (q.type === "score")
        answers[id] = {
          score: 1,
          probabilities: Object.fromEntries(
            q.criteria.map((_, i) => [String(i), i === 1 ? 0.9 : 0.1 / 3]),
          ),
        };
      if (q.type === "choice") {
        const opts = Object.keys(q.criteria);
        answers[id] = {
          choice: opts[0],
          probabilities: Object.fromEntries(
            opts.map((o, i) => [o, i === 0 ? 0.9 : 0.1 / (opts.length - 1)]),
          ),
        };
      }
    }
    return { answers: answers as never, engineVersion: "fake-1.0.0", inputTokens: 1000 };
  };
  return createEngineDecider({
    id: "fake-1.0.0",
    capabilities: {
      ...RULES_CAPABILITIES,
      locality: "cloud",
      costPerMTok: 0.042,
      deterministic: true,
    },
    call,
  });
}

/** sha256 of every file in a directory tree (relative path -> hash). */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, prefix = "") => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p, `${prefix}${f}/`);
      else out[`${prefix}${f}`] = createHash("sha256").update(readFileSync(p)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

async function build(
  grid: Grid,
  outDir: string,
  live?: ReturnType<typeof fakeEngine>,
  recFile?: string,
) {
  const site = SITES[grid.site];
  const recordings = (recFile && loadRecordings(recFile)) || emptyRecordings("fake-1.0.0");
  const decider = createStoreDecider(
    recordings,
    live?.capabilities ?? fakeEngine().capabilities,
    live,
    () => new Date("2026-10-01T00:00:00Z"),
  );
  try {
    return await buildSite({
      grid,
      manifests: site.manifests,
      calibration: undefined,
      decider,
      recordings,
      outDir,
    });
  } finally {
    if (recFile) saveRecordings(recFile, recordings);
  }
}

describe("plan precompute (launch-site 2.2-2.3)", () => {
  const rec = join(work, "hotel.json.gz");
  const out = join(work, "hotel");

  it("writes a bundle where every combination resolves to a valid plan and data", async () => {
    const result = await build(HOTEL, out, fakeEngine(), rec);
    const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
    const total = HOTEL.controls.reduce((n, c) => n * c.options.length, 1);
    expect(index.entries).toHaveLength(total);
    expect(result.combinations).toBe(total);
    for (const [p, d] of index.entries as Array<[number, number]>) {
      const plan = validatePlan(
        JSON.parse(readFileSync(join(out, "plans", `${index.plans[p]}.json`), "utf8")),
      );
      for (const why of [...Object.values(plan.layout).flat(), ...plan.excluded].flatMap(
        (b) => b.why,
      ))
        expect(why.decidedBy).not.toBe("ungated");
      for (const hash of Object.values(index.dataSets[d] as Record<string, string>))
        expect(statSync(join(out, "data", `${hash}.json`)).isFile()).toBe(true);
    }
    const meta = JSON.parse(readFileSync(join(out, "meta.json"), "utf8"));
    expect(meta.situations).toBe(index.plans.length);
    expect(meta.totals.inputTokens).toBe(1000 * index.plans.length);
  });

  it("replays for free and writes byte-identical files", async () => {
    const first = tree(out);
    const again = join(work, "hotel-again");
    await build(HOTEL, again, undefined, rec);
    expect(tree(again)).toEqual(first);
  });

  it("keeps the previous bundle when the engine fails, and resumes from what was recorded", async () => {
    const before = tree(out);
    const fresh = join(work, "fresh.json.gz");
    await expect(build(HOTEL, out, fakeEngine(5), fresh)).rejects.toBeInstanceOf(EngineFailure);
    expect(tree(out)).toEqual(before);
    expect(Object.keys(loadRecordings(fresh)!.sets).length).toBeGreaterThanOrEqual(4);
  });

  it("contains no API key, visitor coordinates or envelope fields", async () => {
    const welcomeOut = join(work, "welcome");
    await build(WELCOME, welcomeOut, fakeEngine());
    for (const dir of [out, welcomeOut]) {
      const all = Object.keys(tree(dir))
        .map((f) => readFileSync(join(dir, f), "utf8"))
        .join("\n");
      for (const forbidden of [
        "apiKey",
        "Bearer",
        "firstParty",
        "referrer",
        '"utm"',
        "visitorGeo",
        '"consent"',
      ])
        expect(all, forbidden).not.toContain(forbidden);
      // Visitor positions the grid synthesizes (pointAtDistance) never appear.
      const env = HOTEL.envelope(
        Object.fromEntries(HOTEL.controls.map((c) => [c.id, c.options[0]!.value])),
      );
      if (env.geo) expect(all).not.toContain(String(env.geo.lat));
    }
  });
});
