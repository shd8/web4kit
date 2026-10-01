/**
 * web4-bench (spec: benchmark).
 *
 *   pnpm bench export                          write bench/data/v1 from the conformance fixtures
 *   pnpm bench check                           dataset up to date, published entries re-score
 *   pnpm bench run --engine rules|laya|jev|local [--repeats 3] [--out file] [--yes]
 *                  [--from-recordings dir]     replay recordings instead of calling the engine
 *                  [--open-weights --weights-gb 1.5 --offline --training-data "…"]
 *   pnpm bench score <submission> [--out-dir dir]
 *   pnpm bench leaderboard add <submission> --id <id> [--publish] [--measured-at <date>]
 *   pnpm bench leaderboard                     print the table
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Recordings } from "@web4kit/conformance";
import {
  type Decider,
  isReachable,
  localEngineUrlFromEnv,
  remoteEnginesFromEnv,
} from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import { createManifestRuleDecider } from "@web4kit/planner";
import { DEFAULT_DATA_DIR, loadDataset, readDataFiles, writeDataset } from "./data";
import { exportDataset } from "./export";
import { gzip, type SubmissionMeta, serialiseSubmission } from "./format";
import {
  type Entry,
  leaderboardDir,
  loadEntries,
  loadSubmission,
  renderLeaderboard,
} from "./leaderboard";
import {
  type EngineFor,
  estimateRun,
  makeSubmission,
  mergeRecordings,
  recordingsDecider,
} from "./run";
import { renderScore, scoreSubmission } from "./score";
import { SITES } from "./sites";

const root = resolve(import.meta.dirname, "../..");
loadDotEnv(resolve(root, ".env"));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    engine: { type: "string" },
    repeats: { type: "string" },
    out: { type: "string" },
    "out-dir": { type: "string" },
    yes: { type: "boolean", default: false },
    "from-recordings": { type: "string" },
    "open-weights": { type: "boolean", default: false },
    "weights-gb": { type: "string" },
    offline: { type: "boolean", default: false },
    "training-data": { type: "string" },
    notes: { type: "string" },
    id: { type: "string" },
    publish: { type: "boolean", default: false },
    "measured-at": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});
const [command, ...rest] = positionals;

const USAGE = readFileSync(import.meta.filename, "utf8")
  .match(/\/\*\*([\s\S]*?)\*\//)![1]!
  .split("\n")
  .map((l) => l.replace(/^ \* ?/, ""))
  .join("\n")
  .trim();

/** Hosted Jev: weights not public, not offline. */
const JEV_META = {
  openWeights: false,
  weightsGB: null,
  offline: false,
  trainingData: "TypeSafe's (not disclosed); no web4-bench data",
};

const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

switch (values.help ? "help" : command) {
  case "export": {
    const out = resolve(values["out-dir"] ?? DEFAULT_DATA_DIR);
    const e = exportDataset();
    writeDataset(out, e);
    const s = e.meta.splits;
    console.log(
      `✓ web4-bench ${e.meta.version} → ${out}\n  dev: ${s.dev.items} items, ${s.dev.labels} labels (${s.dev.sites.join(", ")})\n  test: ${s.test.items} items, ${s.test.labels} labels (${s.test.sites.join(", ")})\n  hash ${e.meta.contentHash}`,
    );
    break;
  }
  case "check": {
    await check();
    break;
  }
  case "run": {
    await run();
    break;
  }
  case "score": {
    const file = rest[0] ?? fail("usage: pnpm bench score <submission>");
    const score = await scoreSubmission(loadDataset(), loadSubmission(resolve(file)));
    const md = renderScore(score);
    if (values["out-dir"]) {
      const dir = resolve(values["out-dir"]);
      mkdirSync(dir, { recursive: true });
      const name = basename(file).replace(/\.jsonl(\.gz)?$/, "");
      writeFileSync(resolve(dir, `${name}.score.json`), `${JSON.stringify(score, null, 2)}\n`);
      writeFileSync(resolve(dir, `${name}.score.md`), md);
    }
    console.log(md);
    break;
  }
  case "leaderboard": {
    if (rest[0] === "add")
      await addEntry(rest[1] ?? fail("usage: leaderboard add <submission> --id <id>"));
    else console.log(renderLeaderboard(loadEntries()));
    break;
  }
  default:
    console.log(USAGE);
}

async function check() {
  let ok = true;
  // 1. The committed dataset is what the current fixtures produce (compared uncompressed).
  const fresh = exportDataset();
  const committed = readDataFiles(DEFAULT_DATA_DIR);
  const stale = new Set<string>();
  for (const name of new Set([...Object.keys(fresh.files), ...Object.keys(committed)]))
    if (fresh.files[name] !== committed[name]) stale.add(name.split(".")[0]!);
  const meta = existsSync(resolve(DEFAULT_DATA_DIR, "dataset.json"))
    ? readFileSync(resolve(DEFAULT_DATA_DIR, "dataset.json"), "utf8")
    : "";
  if (meta !== `${JSON.stringify(fresh.meta, null, 2)}\n`) stale.add("dataset.json");
  if (stale.size) {
    ok = false;
    console.error(
      `✗ web4-bench is stale for: ${[...stale].sort().join(", ")}. Run \`pnpm bench export\` and commit bench/data.`,
    );
  } else
    console.log(
      `✓ dataset ${fresh.meta.version} matches the fixtures (${fresh.meta.contentHash.slice(0, 12)})`,
    );

  // 2. Every published entry re-scores to exactly its committed numbers.
  if (ok) {
    const dataset = loadDataset();
    for (const entry of loadEntries()) {
      if (!entry.published) {
        console.log(`· ${entry.id}: reported only (not re-scored)`);
        continue;
      }
      const file = resolve(leaderboardDir(), entry.submission ?? "");
      if (!entry.submission || !existsSync(file)) {
        ok = false;
        console.error(`✗ ${entry.id}: submission ${entry.submission} missing`);
        continue;
      }
      const score = await scoreSubmission(dataset, loadSubmission(file));
      if (JSON.stringify(score) !== JSON.stringify(entry.score)) {
        ok = false;
        console.error(`✗ ${entry.id}: committed scores differ from a re-score of its submission`);
      } else console.log(`✓ ${entry.id}: re-scored, identical`);
    }
  }
  if (!ok) process.exit(1);
}

async function run() {
  const engine = values.engine ?? fail("--engine rules|laya|jev|local is required");
  const repeats = Number(values.repeats ?? (engine === "rules" || engine === "laya" ? 1 : 3));
  let engineFor: EngineFor;
  let meta: Omit<SubmissionMeta, "engineVersion" | "dataset" | "repeats" | "createdAt">;
  const custom = {
    openWeights: values["open-weights"],
    weightsGB: values["weights-gb"] ? Number(values["weights-gb"]) : null,
    offline: values.offline,
    trainingData: values["training-data"] ?? "not stated",
    ...(values.notes ? { notes: values.notes } : {}),
  };

  if (values["from-recordings"]) {
    const dir = resolve(values["from-recordings"]);
    const files = readdirSync(dir).filter((n) => n.endsWith(".json"));
    if (!files.length) fail(`no recordings (*.json) in ${dir}`);
    const recordings = mergeRecordings(
      files.map((n) => JSON.parse(readFileSync(resolve(dir, n), "utf8")) as Recordings),
    );
    engineFor = recordingsDecider(recordings);
    meta = engine === "jev" ? { engine, ...JEV_META } : { engine, ...custom };
    console.log(
      `Replaying ${Object.keys(recordings.sets).length} recorded question sets of ${recordings.engineVersion} (no engine is called).`,
    );
  } else if (engine === "rules") {
    engineFor = (site) => createManifestRuleDecider(site.manifests);
    meta = {
      engine,
      openWeights: true,
      weightsGB: 0,
      offline: true,
      trainingData: "none: the manifests' hand-written heuristics and defaults",
    };
  } else if (engine === "laya") {
    let laya: Promise<Decider> | undefined;
    engineFor = () =>
      (laya ??= import("@web4kit/decider-laya").then((m) => m.createInProcessLayaDecider()));
    meta = {
      engine,
      openWeights: true,
      weightsGB: 1.7,
      offline: true,
      trainingData: "Laya as published (no web4-specific training)",
    };
  } else if (engine === "jev") {
    const jev = remoteEnginesFromEnv().jev ?? fail("JEV_API_KEY is not set");
    const { requests, tokens } = estimateRun(SITES, repeats);
    const cost = (tokens / 1e6) * jev.capabilities.costPerMTok;
    console.log(
      `Jev (${jev.id}): ${requests} requests, ~${tokens.toLocaleString("en")} input tokens, ~$${cost.toFixed(2)}.`,
    );
    if (!values.yes) {
      console.log("Nothing was sent. Re-run with --yes to spend it.");
      return;
    }
    engineFor = () => jev;
    meta = { engine, ...JEV_META };
  } else if (engine === "local") {
    const url = localEngineUrlFromEnv() ?? fail("W4_LOCAL_ENGINE_URL is not set");
    const local = remoteEnginesFromEnv().local!;
    if (!(await isReachable(url))) fail(`no System One endpoint at ${url}`);
    engineFor = () => local;
    meta = { engine, ...custom };
  } else return fail(`unknown engine ${engine}`);

  const submission = await makeSubmission({
    engineFor,
    repeats,
    meta,
    onProgress: (done, total) => {
      if (process.stdout.isTTY) process.stdout.write(`\r${done}/${total}`);
      else if (done % 25 === 0 || done === total) console.log(`${done}/${total}`);
    },
  });
  if (process.stdout.isTTY) process.stdout.write("\n");
  const out = resolve(
    values.out ??
      resolve(
        tmpdir(),
        `web4-bench-${submission.meta.engineVersion.replace(/[^a-zA-Z0-9._-]+/g, "_")}.jsonl.gz`,
      ),
  );
  const text = serialiseSubmission(submission);
  writeFileSync(out, out.endsWith(".gz") ? gzip(text) : text);
  console.log(
    `✓ ${submission.lines.length} answer sets from ${submission.meta.engineVersion} → ${out}`,
  );
}

async function addEntry(file: string) {
  const id = values.id ?? fail("--id is required");
  const submission = loadSubmission(resolve(file));
  const score = await scoreSubmission(loadDataset(), submission);
  const entry: Entry = {
    id,
    published: values.publish,
    measuredAt: values["measured-at"] ?? submission.meta.createdAt,
    score,
  };
  if (values.publish) {
    const rel = `submissions/${id}.jsonl.gz`;
    mkdirSync(resolve(leaderboardDir(), "submissions"), { recursive: true });
    writeFileSync(resolve(leaderboardDir(), rel), gzip(serialiseSubmission(submission)));
    entry.submission = rel;
  }
  writeFileSync(resolve(leaderboardDir(), `${id}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  console.log(renderScore(score));
  console.log(`✓ leaderboard entry ${id} (${values.publish ? "published" : "reported only"})`);
}
