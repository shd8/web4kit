/**
 * Measure the configured engine on this site's fixtures and write its calibration profile.
 *   pnpm calibrate            (needs JEV_API_KEY; under $0.01 of Jev usage)
 * Re-run after changing what the model sees (what, not_for, audience, tags). Headings,
 * heuristics and defaults can change freely: the profile stays valid.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderReport, runEngine } from "@web4kit/conformance";
import { createJevDecider, jevConfigFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import { createManifestRuleDecider } from "@web4kit/planner";
import { suiteFixtures } from "../web4/personas";
import { manifests } from "../web4/sources";

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

const jev = jevConfigFromEnv();
if (!jev) {
  console.log("JEV_API_KEY not set: skipping Jev. Pages will be planned by rules.");
  process.exit(0);
}
const run = await runEngine({ manifests, fixtures, decider: createJevDecider(jev), repeats: 3 });
const dir = resolve(import.meta.dirname, "../calibration");
mkdirSync(dir, { recursive: true });
writeFileSync(
  resolve(dir, `${run.engineVersion}.json`),
  `${JSON.stringify(run.profile, null, 2)}\n`,
);
writeFileSync(resolve(dir, "report.md"), renderReport(manifests.site, [rules, run]));
console.log(
  `${run.engineVersion}: invariants ${(run.invariantPassRate * 100).toFixed(1)}%, ${Math.round(run.inputTokensPerPlan)} tokens and $${run.costPerPlanUsd.toFixed(5)} per uncached page`,
);
console.log("Wrote calibration/ and calibration/report.md");
