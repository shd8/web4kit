/**
 * Measure the configured engine on this site's fixtures and write its calibration profile.
 *   pnpm calibrate                   Jev (needs JEV_API_KEY; ~$0.05)
 *   W4_ENGINE=laya pnpm calibrate    Laya in-process: free and offline
 * Re-run after changing what the model sees (what, not_for, audience, tags). Headings,
 * heuristics and defaults can change freely: the profile stays valid.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderReport, runEngine } from "@web4kit/conformance";
import { loadDotEnv } from "@web4kit/decider/node";
import { createManifestRuleDecider } from "@web4kit/planner";
import { calibrationFileName } from "@web4kit/planner/node";
import { engineFromEnv } from "../web4/engine";
import { suiteFixtures } from "../web4/fixtures";
import { manifests } from "../web4/manifests";

loadDotEnv(resolve(import.meta.dirname, "../.env"));
const fixtures = suiteFixtures();

const rules = await runEngine({
  manifests,
  fixtures,
  decider: createManifestRuleDecider(manifests),
});
console.log(
  `rules: invariants ${(rules.invariantPassRate * 100).toFixed(1)}% on ${fixtures.length} fixtures`,
);
if (rules.invariantPassRate < 1) {
  console.error(
    "The rules engine must pass every invariant (it is the fallback):",
    rules.invariantFailures.slice(0, 5),
  );
  process.exit(1);
}

const decider = await engineFromEnv();
if (!decider) {
  console.log("No engine configured (JEV_API_KEY or W4_ENGINE=laya): pages are planned by rules.");
  process.exit(0);
}
const deterministic = decider.capabilities.deterministic === true;
const run = await runEngine({ manifests, fixtures, decider, repeats: deterministic ? 1 : 3 });
const dir = resolve(import.meta.dirname, "../calibration");
mkdirSync(dir, { recursive: true });
writeFileSync(
  resolve(dir, calibrationFileName(decider.id)),
  `${JSON.stringify(run.profile, null, 2)}\n`,
);
writeFileSync(resolve(dir, "report.md"), renderReport(manifests.site, [rules, run]));
console.log(
  `${run.engineVersion}: invariants ${(run.invariantPassRate * 100).toFixed(1)}%, ${Math.round(run.inputTokensPerPlan)} tokens and $${run.costPerPlanUsd.toFixed(5)} per uncached page`,
);
console.log("Wrote calibration/ and calibration/report.md");
await (decider as { close?: () => Promise<void> }).close?.();
