/**
 * web4 conformance suite (spec: conformance-suite).
 *
 *   pnpm conformance                              # rules only (offline, CI)
 *   pnpm conformance --engines rules,jev          # + hosted Jev (JEV_API_KEY)
 *   pnpm conformance --engines rules,laya         # + in-process Laya (free, offline; for testing)
 *   pnpm conformance --engines rules,jev,local    # + local System One endpoint (W4_LOCAL_ENGINE_URL)
 *   options: --example restaurant|db-explorer|all  --repeats 3  --limit 160  --write (commit profiles)
 *            --report-dir reports
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  type EngineRun,
  renderReport,
  runEngine,
  type SituatedFixture,
} from "@web4kit/conformance";
import {
  type Decider,
  isReachable,
  localEngineUrlFromEnv,
  remoteEnginesFromEnv,
} from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import type { ManifestSet } from "@web4kit/manifest";
import { createManifestRuleDecider } from "@web4kit/planner";
import * as explorer from "../examples/db-explorer/src/index";
import { suiteFixtures as explorerSuite } from "../examples/db-explorer/src/suite";
import * as restaurant from "../examples/restaurant/src/index";
import { suiteFixtures as restaurantSuite } from "../examples/restaurant/src/suite";

/** In-process Laya, loaded once on first use. */
let laya: Promise<Decider> | undefined;
const root = resolve(import.meta.dirname, "..");
loadDotEnv(resolve(root, ".env"));

const { values } = parseArgs({
  options: {
    example: { type: "string", default: "all" },
    engines: { type: "string", default: "rules" },
    repeats: { type: "string", default: "3" },
    limit: { type: "string", default: "160" },
    concurrency: { type: "string", default: "4" },
    write: { type: "boolean", default: false },
    "report-dir": { type: "string", default: "reports" },
  },
});

interface Example {
  site: string;
  manifests: ManifestSet;
  fixtures: (limit: number) => SituatedFixture[];
}
const EXAMPLES: Record<string, Example> = {
  restaurant: {
    site: restaurant.manifests.site,
    manifests: restaurant.manifests,
    fixtures: restaurantSuite,
  },
  "db-explorer": {
    site: explorer.manifests.site,
    manifests: explorer.manifests,
    fixtures: explorerSuite,
  },
};

const selected = values.example === "all" ? Object.keys(EXAMPLES) : [values.example!];
const engineNames = values.engines!.split(",").map((s) => s.trim());
const remote = remoteEnginesFromEnv();
let failed = false;

for (const name of selected) {
  const example = EXAMPLES[name];
  if (!example) throw new Error(`unknown example ${name}`);
  const fixtures = example.fixtures(Number(values.limit));
  const runs: EngineRun[] = [];
  for (const engineName of engineNames) {
    const decider = await engineFor(engineName, example.manifests);
    if (typeof decider === "string") {
      runs.push(skipped(engineName, decider));
      console.log(`[${name}] ${engineName}: skipped (${decider})`);
      continue;
    }
    const started = Date.now();
    const run = await runEngine({
      manifests: example.manifests,
      fixtures,
      decider,
      repeats: Number(values.repeats),
      concurrency: Number(values.concurrency),
      ...(process.stdout.isTTY
        ? {
            onProgress: (d: number, t: number) =>
              process.stdout.write(`\r[${name}] ${engineName}: ${d}/${t} plans`),
          }
        : {}),
    });
    if (process.stdout.isTTY) process.stdout.write("\n");
    console.log(
      `[${name}] ${run.engineVersion}: invariants ${(run.invariantPassRate * 100).toFixed(1)}%, ${run.labelled} labelled answers, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    runs.push(run);
    if (engineName === "rules" && run.invariantPassRate < 1) {
      failed = true;
      console.error(
        `[${name}] rules decider failed invariants:`,
        run.invariantFailures.slice(0, 5),
      );
    }
    if (values.write && engineName !== "rules" && run.profile) {
      const dir = resolve(root, "calibration", example.site);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, `${safe(run.engineVersion)}.json`),
        `${JSON.stringify(run.profile, null, 2)}\n`,
      );
    }
  }
  const dir = resolve(root, values["report-dir"]!);
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `conformance-${example.site}.md`);
  writeFileSync(file, renderReport(example.site, runs));
  console.log(`[${name}] report: ${file}`);
}
await laya?.then((d) => (d as { close?: () => Promise<void> }).close?.());
process.exit(failed ? 1 : 0);

async function engineFor(engine: string, manifests: ManifestSet): Promise<Decider | string> {
  if (engine === "rules") return createManifestRuleDecider(manifests);
  if (engine === "jev") return remote.jev ?? "JEV_API_KEY not set";
  if (engine === "laya") {
    laya ??= import("@web4kit/decider-laya").then((m) => m.createInProcessLayaDecider());
    return laya;
  }
  if (engine === "local") {
    const url = localEngineUrlFromEnv();
    if (!remote.local || !url) return "W4_LOCAL_ENGINE_URL not set";
    return (await isReachable(url)) ? remote.local : `no System One endpoint at ${url}`;
  }
  return `unknown engine ${engine}`;
}

function skipped(engine: string, reason: string): EngineRun {
  return {
    engine,
    engineVersion: engine,
    skipped: reason,
    engineFailures: 0,
    fixtures: 0,
    labelled: 0,
    repeats: 0,
    byKind: {},
    invariantPassRate: 0,
    invariantFailures: [],
    latencyMs: { p50: 0, p95: 0 },
    inputTokensPerPlan: 0,
    costPerPlanUsd: 0,
  };
}

function safe(id: string) {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
