import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Situation, situationHash } from "@web4kit/context";
import type { Decider } from "@web4kit/decider";
import { type Plan, stableHash, validatePlan } from "@web4kit/ir";
import type { ManifestSet } from "@web4kit/manifest";
import { buildQuestions, type CalibrationProfile, createPlanner } from "@web4kit/planner";
import { resolvePlanData } from "@web4kit/react";
import { combinations, comboCount, type Grid } from "./grid";
import { stableJson, stableJsonCompact } from "./json";
import { EngineFailure, type SiteRecordings } from "./store";

/** Distinct situations of a grid, in first-seen combination order. */
export function distinctSituations(grid: Grid) {
  const byHash = new Map<string, Situation>();
  for (const values of combinations(grid.controls)) {
    const situation = grid.situationOf(grid.envelope(values));
    const hash = situationHash(situation);
    if (!byHash.has(hash)) byHash.set(hash, situation);
  }
  return byHash;
}

/** The decider request a situation produces (what a recording is keyed by). */
export const requestFor = (manifests: ManifestSet, situation: Situation) => {
  const qp = buildQuestions(manifests, situation);
  return { state: qp.state, questions: qp.questions };
};

export interface BuildInput {
  grid: Grid;
  manifests: ManifestSet;
  calibration: CalibrationProfile | undefined;
  decider: Decider & { failures: string[] };
  recordings: SiteRecordings;
  /** Directory the site's bundle is written to (replaced only when the build succeeds). */
  outDir: string;
  concurrency?: number;
  log?: (line: string) => void;
}

export interface BuildResult {
  combinations: number;
  situations: number;
  dataFiles: number;
  costUsd: number;
}

/**
 * Plan every distinct situation once (production gating), resolve data for every combination,
 * and write the site's static bundle (design D2-D4).
 */
export async function buildSite(input: BuildInput): Promise<BuildResult> {
  const { grid, manifests, decider, recordings } = input;
  const log = input.log ?? (() => {});
  const planner = createPlanner({
    manifests,
    decider,
    ...(input.calibration ? { calibration: input.calibration } : {}),
    gating: "production",
  });
  const costPerMTok = decider.capabilities.costPerMTok ?? 0;

  // 1. Plan each distinct situation once.
  const situations = distinctSituations(grid);
  const plans = new Map<string, Plan>();
  const queue = [...situations.entries()];
  let done = 0;
  let aborted = false;
  const worker = async () => {
    for (let next = queue.shift(); next && !aborted; next = queue.shift()) {
      const [hash, situation] = next;
      let result: Awaited<ReturnType<typeof planner.plan>>;
      try {
        result = await planner.plan({ situation });
      } catch (e) {
        aborted = true;
        throw new EngineFailure(`${grid.site} ${JSON.stringify(situation)}: ${e}`);
      }
      if (decider.failures.length) {
        aborted = true;
        throw new EngineFailure(
          `${grid.site} ${JSON.stringify(situation)}: ${decider.failures[0]} (nothing was written)`,
        );
      }
      const plan = validatePlan(result.plan);
      for (const block of [...Object.values(plan.layout).flat(), ...plan.excluded])
        for (const why of block.why) {
          if (why.decidedBy === "ungated") throw new Error(`ungated record in ${hash}`);
          if (why.note?.startsWith("engine failed"))
            throw new EngineFailure(`${grid.site} ${hash}: ${why.note} (nothing was written)`);
        }
      plans.set(hash, plan);
      // Keep the usage of the original (live) planning; a replay must not overwrite it.
      if (result.usage.requests > 0 && !recordings.usage[hash])
        recordings.usage[hash] = {
          inputTokens: result.usage.inputTokens,
          requests: result.usage.requests,
          planningMs: Math.round(result.planningMs),
        };
      if (++done % 200 === 0) log(`  ${grid.site}: ${done}/${situations.size} planned`);
    }
  };
  await Promise.all(Array.from({ length: input.concurrency ?? 6 }, worker));

  // 2. Resolve data for every combination; store each source's snapshot once by content.
  const data = new Map<string, string>(); // hash -> json
  const dataSets: Array<Record<string, string>> = [];
  const dataSetIndex = new Map<string, number>();
  const planHashes = [...plans.keys()].sort();
  const planIndex = new Map(planHashes.map((h, i) => [h, i]));
  const entries: Array<[number, number]> = [];
  for (const values of combinations(grid.controls)) {
    const envelope = grid.envelope(values);
    const situation = grid.situationOf(envelope);
    const hash = situationHash(situation);
    const plan = plans.get(hash)!;
    const resolved = await resolvePlanData(plan, manifests, {
      now: new Date(envelope.now),
      viewer: { roles: [] },
      situation,
      ...(envelope.timezone ? { timezone: envelope.timezone } : {}),
      ...(envelope.languages[0] ? { locale: envelope.languages[0] } : {}),
      ...(situation.language ? { language: situation.language } : {}),
      ...(envelope.geo ? { visitorGeo: { lat: envelope.geo.lat, lng: envelope.geo.lng } } : {}),
    });
    const set: Record<string, string> = {};
    for (const [sourceId, entry] of Object.entries(resolved).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const json = stableJsonCompact(entry);
      const h = stableHash(json, 16);
      data.set(h, json);
      set[sourceId] = h;
    }
    const setKey = stableJsonCompact(set);
    let d = dataSetIndex.get(setKey);
    if (d === undefined) {
      d = dataSets.length;
      dataSets.push(set);
      dataSetIndex.set(setKey, d);
    }
    entries.push([planIndex.get(hash)!, d]);
  }

  // 3. Write to a temp directory, then swap it in.
  const tmp = `${input.outDir}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, "plans"), { recursive: true });
  mkdirSync(join(tmp, "data"), { recursive: true });
  // Compact: plans and the index are most of the bytes (served gzipped, ~2 KB per view).
  for (const [hash, plan] of plans)
    writeFileSync(join(tmp, "plans", `${hash}.json`), `${stableJsonCompact(plan)}\n`);
  for (const [hash, json] of data) writeFileSync(join(tmp, "data", `${hash}.json`), `${json}\n`);
  // The labels each plan was made for (what the model saw): for the docs embeds only.
  writeFileSync(
    join(tmp, "situations.json"),
    stableJson(Object.fromEntries(planHashes.map((h) => [h, situations.get(h)!]))),
  );
  writeFileSync(
    join(tmp, "manifests.json"),
    stableJson(JSON.parse(JSON.stringify(manifests, (k, v) => (k === "fetch" ? undefined : v)))),
  );
  writeFileSync(
    join(tmp, "index.json"),
    `${stableJsonCompact({
      site: grid.site,
      title: grid.title,
      controls: grid.controls,
      personas: grid.personas.map((p) => ({ name: p.name, title: p.title, values: p.values })),
      plans: planHashes,
      dataSets,
      // Dense, in combination order (first control varies slowest): [plan, dataSet].
      entries,
    })}\n`,
  );
  const usage = Object.fromEntries(
    planHashes.map((h) => {
      const u = recordings.usage[h] ?? { inputTokens: 0, requests: 0, planningMs: 0 };
      return [h, { ...u, costUsd: (u.inputTokens / 1e6) * costPerMTok }];
    }),
  );
  const costUsd = Object.values(usage).reduce((s, u) => s + u.costUsd, 0);
  const stamps = Object.values(recordings.recordedAt).sort();
  writeFileSync(
    join(tmp, "meta.json"),
    stableJson({
      site: grid.site,
      engine: planner.engineId,
      calibration: planner.calibrationStatus,
      generatedAt: stamps.at(-1) ?? null,
      combinations: comboCount(grid.controls),
      situations: planHashes.length,
      totals: {
        inputTokens: Object.values(usage).reduce((s, u) => s + u.inputTokens, 0),
        requests: Object.values(usage).reduce((s, u) => s + u.requests, 0),
        costUsd,
      },
      plans: usage,
    }),
  );
  if (existsSync(input.outDir)) rmSync(input.outDir, { recursive: true });
  renameSync(tmp, input.outDir);
  return {
    combinations: entries.length,
    situations: planHashes.length,
    dataFiles: data.size,
    costUsd,
  };
}
