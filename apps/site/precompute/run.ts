/**
 * Precompute the playground (OpenSpec change: launch-site, design D1-D4).
 *   pnpm precompute                 dry run: situations to plan and the estimated Jev cost
 *   pnpm precompute --yes           plan what is not recorded yet with Jev, then write bundles
 *   pnpm precompute --replay        write bundles from the recordings only (free; fails if any is missing)
 *   pnpm precompute --check         fail if bundles or recordings are stale for the current manifests
 *   --site hotel                    one site only
 */
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { recordingKey } from "@web4kit/conformance";
import {
  createJevDecider,
  type Decider,
  estimateTokens,
  JEV_CAPABILITIES,
  jevConfigFromEnv,
} from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import { loadCalibration } from "@web4kit/planner/node";
import { buildSite, distinctSituations, requestFor } from "./bundle";
import { SITE_IDS, SITES } from "./sites";
import {
  createStoreDecider,
  EngineFailure,
  emptyRecordings,
  loadRecordings,
  saveRecordings,
} from "./store";

const ROOT = resolve(import.meta.dirname, "../../..");
const REQUEST_OVERHEAD = 1.17;
export const BUNDLE_DIR = resolve(import.meta.dirname, "../public/playground");
export const recordingsFile = (site: string) =>
  resolve(import.meta.dirname, "recordings", `${site}.json.gz`);

const { values: args } = parseArgs({
  options: {
    yes: { type: "boolean", default: false },
    replay: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
    site: { type: "string" },
  },
});
loadDotEnv(resolve(ROOT, ".env"));

const sites = args.site ? [args.site as (typeof SITE_IDS)[number]] : SITE_IDS;
const jev = jevConfigFromEnv();
const live: Decider | undefined = args.yes && jev ? createJevDecider(jev) : undefined;
if (args.yes && !live) {
  console.error("✖ --yes needs JEV_API_KEY in .env");
  process.exit(1);
}
const capabilities = live?.capabilities ?? JEV_CAPABILITIES;

let totalUsd = 0;
let stale = 0;
for (const site of sites) {
  const { grid, manifests, calibrationDir } = SITES[site];
  const engineId = live?.id ?? loadRecordings(recordingsFile(site))?.engine ?? "jev-1.13.0";
  const recordings = loadRecordings(recordingsFile(site)) ?? emptyRecordings(engineId);
  const situations = distinctSituations(grid);
  let missing = 0;
  let tokens = 0;
  for (const situation of situations.values()) {
    const { state, questions } = requestFor(manifests, situation);
    if (recordings.sets[recordingKey(state, questions)]) continue;
    missing++;
    tokens += estimateTokens({ state, questions });
  }
  // Real requests carry ~17% more input tokens than the questions alone (request envelope and
  // fitting overhead), measured on the first full run: restaurant 1.168, hotel 1.162, welcome 1.169.
  const billed = tokens * REQUEST_OVERHEAD;
  const usd = (billed / 1e6) * capabilities.costPerMTok;
  totalUsd += usd;
  console.log(
    `${site}: ${situations.size} situations, ${situations.size - missing} recorded, ${missing} to plan (≈${Math.round(billed / Math.max(missing, 1))} tokens each, ≈$${usd.toFixed(2)})`,
  );

  if (args.check) {
    if (missing > 0) {
      stale++;
      console.error(`✖ ${site}: ${missing} situations changed since the bundle was made`);
    }
    continue;
  }
  if (!args.yes && !args.replay) continue;
  if (args.replay && missing > 0) {
    console.error(`✖ ${site}: ${missing} situations are not recorded; run with --yes`);
    process.exit(1);
  }

  const decider = createStoreDecider(recordings, capabilities, live);
  const calibration = loadCalibration(calibrationDir, decider.id);
  try {
    const result = await buildSite({
      grid,
      manifests,
      calibration,
      decider,
      recordings,
      outDir: resolve(BUNDLE_DIR, site),
      log: console.log,
    });
    console.log(
      `✓ ${site}: ${result.combinations} combinations, ${result.situations} plans, ${result.dataFiles} data files, $${result.costUsd.toFixed(4)} of recorded planning`,
    );
  } catch (e) {
    if (e instanceof EngineFailure) console.error(`✖ ${e.message}`);
    else throw e;
    process.exitCode = 1;
  } finally {
    // Keep whatever was recorded, so a re-run resumes without paying twice.
    if (live?.id && decider.liveCalls() > 0) saveRecordings(recordingsFile(site), recordings);
  }
  if (process.exitCode) break;
}

if (args.check) {
  if (stale) process.exit(1);
  console.log("✓ playground bundles are current");
} else if (!args.yes && !args.replay) {
  console.log(
    `\nDry run: ≈$${totalUsd.toFixed(2)} of Jev to plan what is missing. Re-run with --yes to spend it, or --replay to rebuild from the recordings.`,
  );
}
