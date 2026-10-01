/**
 * Heuristic ablation (OpenSpec change: launch-ablation). Does a calibrated System One model plan
 * good pages from descriptions alone, while a rules engine needs hand-written heuristics?
 *
 *   pnpm ablation                       # estimate the Jev spend, record nothing
 *   pnpm ablation --yes                 # record Jev once per site and arm, then replay
 *   options: --site restaurant|explorer|hotel|welcome|all  --arms h,ha  --seed 7
 *            --engines rules,jev  --record (force fresh recordings)  --out reports/ablation
 *
 * Heuristics never reach the model, so within an arm Jev's answers are identical at every level:
 * they are recorded once and replayed (design D3). Re-rendering from recordings is free.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  createRecordingDecider,
  createReplayDecider,
  type EngineRun,
  type Recordings,
  recordingKey,
  runEngine,
  type SituatedFixture,
} from "@web4kit/conformance";
import type { BucketSpec } from "@web4kit/context";
import { type Decider, estimateTokens, remoteEnginesFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import {
  type DataSourceManifest,
  deciderVersion,
  type ManifestSet,
  manifestVersion,
} from "@web4kit/manifest";
import { buildQuestions, createManifestRuleDecider } from "@web4kit/planner";
import * as explorer from "../examples/db-explorer/src/index";
import { suiteFixtures as explorerSuite } from "../examples/db-explorer/src/suite";
import * as restaurant from "../examples/restaurant/src/index";
import { suiteFixtures as restaurantSuite } from "../examples/restaurant/src/suite";
import { suiteFixtures as hotelSuite } from "../templates/hotel/web4/fixtures";
import { manifests as hotelManifests } from "../templates/hotel/web4/manifests";
import { BUCKETS as hotelBuckets } from "../templates/hotel/web4/situation";
import { suiteFixtures as welcomeSuite } from "../templates/welcome/web4/personas";
import { BUCKETS as welcomeBuckets } from "../templates/welcome/web4/situation";
import { manifests as welcomeManifests } from "../templates/welcome/web4/sources";

const root = resolve(import.meta.dirname, "..");
loadDotEnv(resolve(root, ".env"));

const { values } = parseArgs({
  options: {
    site: { type: "string", default: "all" },
    arms: { type: "string", default: "h,ha" },
    seed: { type: "string", default: "7" },
    "robustness-seed": { type: "string", default: "1009" },
    engines: { type: "string", default: "rules,jev" },
    yes: { type: "boolean", default: false },
    record: { type: "boolean", default: false },
    out: { type: "string", default: "reports/ablation" },
    cache: { type: "string", default: ".w4-cache/ablation" },
  },
});

// ---------------------------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------------------------

interface Site {
  key: string;
  title: string;
  manifests: ManifestSet;
  buckets: BucketSpec;
  fixtures: SituatedFixture[];
}
const SITES: Record<string, () => Site> = {
  restaurant: () => ({
    key: "restaurant",
    title: "Casa Lumbre (restaurant)",
    manifests: restaurant.manifests,
    buckets: restaurant.BUCKETS,
    fixtures: restaurantSuite(160),
  }),
  explorer: () => ({
    key: "explorer",
    title: "Meridian Supply (database explorer)",
    manifests: explorer.manifests,
    buckets: explorer.BUCKETS,
    fixtures: explorerSuite(),
  }),
  hotel: () => ({
    key: "hotel",
    title: "Casa Ribeira (hotel starter)",
    manifests: hotelManifests,
    buckets: hotelBuckets,
    fixtures: hotelSuite(),
  }),
  welcome: () => ({
    key: "welcome",
    title: "Welcome starter",
    manifests: welcomeManifests,
    buckets: welcomeBuckets,
    fixtures: welcomeSuite(),
  }),
};

const LEVELS = [1, 0.75, 0.5, 0.25, 0] as const;
type Arm = "h" | "ha";
const ARM_TITLE: Record<Arm, string> = {
  h: "heuristics removed",
  ha: "heuristics and audiences removed",
};

// ---------------------------------------------------------------------------------------------
// Manifest transforms (design D1, D2)
// ---------------------------------------------------------------------------------------------

function withSources(m: ManifestSet, sources: DataSourceManifest[]): ManifestSet {
  return {
    ...m,
    sources,
    version: manifestVersion(m.site, sources, m.components),
    deciderVersion: deciderVersion(m.site, sources, m.components),
  };
}

/** The same manifests without any `audience` (arm H+A). Everything else untouched. */
function withoutAudiences(m: ManifestSet): ManifestSet {
  return withSources(
    m,
    m.sources.map(({ audience: _audience, ...s }) => s as DataSourceManifest),
  );
}

/** Deterministic shuffle (xorshift, as expandFixtures). */
function shuffled<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let s = seed >>> 0 || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Keep round(level x N) heuristics, chosen by a seeded order fixed per site, so levels are nested.
 * Kept heuristics keep their declaration order within each source (later ones override).
 */
function keepHeuristics(m: ManifestSet, level: number, seed: number): ManifestSet {
  const pairs = m.sources.flatMap((s) => s.heuristics.map((_, i) => `${s.id}#${i}`));
  const order = shuffled(pairs, seed);
  const kept = new Set(order.slice(0, Math.round(level * pairs.length)));
  return withSources(
    m,
    m.sources.map((s) => ({
      ...s,
      heuristics: s.heuristics.filter((_, i) => kept.has(`${s.id}#${i}`)),
    })),
  );
}

// ---------------------------------------------------------------------------------------------
// Situation-space accounting (design D5)
// ---------------------------------------------------------------------------------------------

const DECISIONS_PER_SOURCE = 5; // relevance, salience, component, region, prominence

function accounting(site: Site) {
  const languages = new Set(site.fixtures.map((f) => f.situation.language).filter(Boolean));
  const buckets = Object.entries(site.buckets).map(([name, labels]) => ({
    name,
    labels: labels.length ? labels.length : languages.size,
  }));
  const situations = buckets.reduce((n, b) => n * Math.max(1, b.labels), 1);
  const covered = new Set(site.fixtures.map((f) => JSON.stringify(f.situation))).size;
  const description = site.manifests.sources.reduce(
    (n, s) => n + s.what.length + (s.not_for?.length ?? 0) + s.tags.join(" ").length,
    0,
  );
  return {
    buckets: buckets.length,
    bucketLabels: Object.fromEntries(buckets.map((b) => [b.name, b.labels])),
    situations,
    fixtures: site.fixtures.length,
    situationsCovered: covered,
    sources: site.manifests.sources.length,
    heuristics: site.manifests.sources.reduce((n, s) => n + s.heuristics.length, 0),
    audiences: site.manifests.sources.filter((s) => s.audience).length,
    descriptionChars: description,
    naiveRules: situations * site.manifests.sources.length * DECISIONS_PER_SOURCE,
  };
}

// ---------------------------------------------------------------------------------------------
// Recording (design D3)
// ---------------------------------------------------------------------------------------------

const cacheDir = resolve(root, values.cache!);
const recordingFile = (site: string, arm: Arm, engine: string) =>
  resolve(cacheDir, `${site}-${arm}-${engine.replace(/[^a-zA-Z0-9._-]+/g, "_")}.json`);

function loadRecordings(file: string): Recordings | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Recordings) : undefined;
}

/** Replays what is recorded and records what is missing (resume after an interrupted run). */
function resumingDecider(inner: Decider, previous: Recordings | undefined) {
  const recorder = createRecordingDecider(inner);
  const served: Record<string, number> = {};
  let spentTokens = 0;
  const decider: Decider = {
    id: inner.id,
    capabilities: inner.capabilities,
    async decide(state, questions, options) {
      const key = recordingKey(state, questions);
      const have = previous?.sets[key] ?? [];
      const n = served[key] ?? 0;
      served[key] = n + 1;
      if (n < have.length) return have[n]!;
      const answers = await recorder.decide(state, questions, options);
      spentTokens += answers.usage.inputTokens;
      return answers;
    },
  };
  const merged = (): Recordings => {
    const fresh = recorder.recordings();
    const sets: Recordings["sets"] = { ...(previous?.sets ?? {}) };
    for (const [k, list] of Object.entries(fresh.sets)) sets[k] = [...(sets[k] ?? []), ...list];
    return {
      engine: inner.id,
      engineVersion: Object.keys(fresh.sets).length
        ? fresh.engineVersion
        : (previous?.engineVersion ?? inner.id),
      sets,
    };
  };
  return { decider, merged, spentTokens: () => spentTokens };
}

const isCreditOrAuth = (e: unknown): boolean => {
  const status = (e as { cause?: { status?: number }; status?: number })?.cause?.status;
  const message = e instanceof Error ? e.message : String(e);
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    /\b(401|402|403)\b|credit|insufficient|unauthori[sz]ed|quota/i.test(message)
  );
};

// ---------------------------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------------------------

interface LevelResult {
  level: number;
  engine: string;
  rawAccuracy: Record<string, { samples: number; accuracy: number }>;
  decisionAccuracy: Record<string, { samples: number; accuracy: number }>;
  decisionAccuracyAll: number;
  relevanceRaw: number | null;
  relevanceDecision: number | null;
  invariantPassRate: number;
  invariantFailures: EngineRun["invariantFailures"];
}

const pooled = (m: Record<string, { samples: number; accuracy: number }>) => {
  const total = Object.values(m).reduce((n, x) => n + x.samples, 0);
  return total ? Object.values(m).reduce((n, x) => n + x.accuracy * x.samples, 0) / total : 0;
};

function summarise(level: number, engine: string, run: EngineRun): LevelResult {
  const raw = Object.fromEntries(
    Object.entries(run.byKind).map(([k, v]) => [k, { samples: v.samples, accuracy: v.accuracy }]),
  );
  return {
    level,
    engine,
    rawAccuracy: raw,
    decisionAccuracy: run.decisionAccuracy,
    decisionAccuracyAll: pooled(run.decisionAccuracy),
    relevanceRaw: raw["A.relevance|english"]?.accuracy ?? null,
    relevanceDecision: run.decisionAccuracy["A.relevance|english"]?.accuracy ?? null,
    invariantPassRate: run.invariantPassRate,
    invariantFailures: run.invariantFailures,
  };
}

async function measureArm(
  site: Site,
  arm: Arm,
  seed: number,
  jev: { recordings: Recordings; capabilities: Decider["capabilities"] } | undefined,
): Promise<LevelResult[]> {
  const base = arm === "ha" ? withoutAudiences(site.manifests) : site.manifests;
  const out: LevelResult[] = [];
  for (const level of LEVELS) {
    const manifests = keepHeuristics(base, level, seed);
    const rules = await runEngine({
      manifests,
      fixtures: site.fixtures,
      decider: createManifestRuleDecider(manifests),
    });
    out.push(summarise(level, "rules", rules));
    if (jev) {
      const replay = createReplayDecider(jev.recordings, jev.capabilities);
      const run = await runEngine({
        manifests,
        fixtures: site.fixtures,
        decider: replay,
        repeats: 3,
      });
      out.push(summarise(level, jev.recordings.engineVersion, run));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Charts (plain SVG, no dependency)
// ---------------------------------------------------------------------------------------------

interface Series {
  name: string;
  color: string;
  dashed?: boolean;
  points: Array<number | null>; // one per LEVELS entry, 0..1
}

function lineChart(title: string, description: string, series: Series[]): string {
  const W = 640;
  const H = 392;
  const m = { top: 48, right: 32, bottom: 104, left: 56 };
  const w = W - m.left - m.right;
  const h = H - m.top - m.bottom;
  const x = (i: number) => m.left + (i * w) / (LEVELS.length - 1);
  const y = (v: number) => m.top + h - v * h;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (v) =>
        `<line x1="${m.left}" x2="${m.left + w}" y1="${y(v)}" y2="${y(v)}" stroke="#d4d4d8" stroke-width="1"/>` +
        `<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="#52525b">${v * 100}%</text>`,
    )
    .join("");
  const xLabels = LEVELS.map(
    (l, i) =>
      `<text x="${x(i)}" y="${m.top + h + 20}" text-anchor="middle" font-size="12" fill="#52525b">${l * 100}%</text>`,
  ).join("");
  const lines = series
    .map((s) => {
      const pts = s.points
        .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
        .filter(Boolean)
        .join(" ");
      const dots = s.points
        .map((v, i) =>
          v === null
            ? ""
            : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${s.color}"/>`,
        )
        .join("");
      return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5"${s.dashed ? ' stroke-dasharray="6 4"' : ""}/>${dots}`;
    })
    .join("");
  const legend = series
    .map((s, i) => {
      const lx = m.left + (i % 2) * 290;
      const ly = m.top + h + 64 + Math.floor(i / 2) * 18;
      return `<line x1="${lx}" x2="${lx + 22}" y1="${ly - 4}" y2="${ly - 4}" stroke="${s.color}" stroke-width="2.5"${s.dashed ? ' stroke-dasharray="6 4"' : ""}/><text x="${lx + 28}" y="${ly}" font-size="12" fill="#27272a">${esc(s.name)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" font-family="Inter, system-ui, sans-serif">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(description)}</desc>
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${m.left}" y="28" font-size="15" font-weight="600" fill="#18181b">${esc(title)}</text>
${grid}${xLabels}
<text x="${m.left + w / 2}" y="${m.top + h + 38}" text-anchor="middle" font-size="12" fill="#52525b">hand-written heuristics kept</text>
${lines}${legend}
</svg>
`;
}

// ---------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------

const siteKeys = values.site === "all" ? Object.keys(SITES) : values.site!.split(",");
const arms = values.arms!.split(",") as Arm[];
const engines = values.engines!.split(",");
const seed = Number(values.seed);
const remote = remoteEnginesFromEnv();
const useJev = engines.includes("jev");
if (useJev && !remote.jev) {
  console.error("JEV_API_KEY is not set (use --engines rules to run without Jev)");
  process.exit(1);
}
const sites = siteKeys.map((k) => {
  const make = SITES[k];
  if (!make) throw new Error(`unknown site ${k}`);
  return make();
});

// Spend estimate: only question sets not already recorded cost anything.
if (useJev) {
  const jev = remote.jev!;
  let tokens = 0;
  for (const site of sites) {
    for (const arm of arms) {
      const previous = values.record
        ? undefined
        : loadRecordings(recordingFile(site.key, arm, jev.id));
      const manifests = arm === "ha" ? withoutAudiences(site.manifests) : site.manifests;
      for (const f of site.fixtures) {
        const qp = buildQuestions(manifests, f.situation, f.intent ? { intent: f.intent } : {});
        const have = previous?.sets[recordingKey(qp.state, qp.questions)]?.length ?? 0;
        const missing = Math.max(0, 3 - have);
        tokens += missing * (estimateTokens(qp.questions) + estimateTokens(qp.state));
      }
    }
  }
  const usd = (tokens / 1e6) * jev.capabilities.costPerMTok;
  console.log(
    `Jev spend to record what is missing: ~${Math.round(tokens).toLocaleString("en")} input tokens, ~$${usd.toFixed(2)}`,
  );
  if (usd > 0 && !values.yes) {
    console.log(
      "Nothing was spent. Re-run with --yes to record, or --engines rules for rules only.",
    );
    process.exit(0);
  }
}

mkdirSync(cacheDir, { recursive: true });
let spentTokens = 0;
const results: Record<string, Record<string, LevelResult[]>> = {};
const robustness: Record<string, Record<string, LevelResult[]>> = {};
const recorded: Record<string, Record<string, Recordings>> = {};

for (const site of sites) {
  results[site.key] = {};
  recorded[site.key] = {};
  for (const arm of arms) {
    let jevRecordings: Recordings | undefined;
    if (useJev) {
      const jev = remote.jev!;
      const file = recordingFile(site.key, arm, jev.id);
      const resume = resumingDecider(jev, values.record ? undefined : loadRecordings(file));
      const manifests = arm === "ha" ? withoutAudiences(site.manifests) : site.manifests;
      try {
        await runEngine({
          manifests,
          fixtures: site.fixtures,
          decider: resume.decider,
          repeats: 3,
        });
      } catch (e) {
        writeFileSync(file, JSON.stringify(resume.merged()));
        spentTokens += resume.spentTokens();
        if (isCreditOrAuth(e)) {
          console.error(
            `\nJev refused a request (${e instanceof Error ? e.message : e}).\nRecorded so far is kept in ${cacheDir}; re-run with a new JEV_API_KEY to resume from ${site.key}/${arm}.`,
          );
          process.exit(2);
        }
        throw e;
      }
      jevRecordings = resume.merged();
      writeFileSync(file, JSON.stringify(jevRecordings));
      spentTokens += resume.spentTokens();
      recorded[site.key]![arm] = jevRecordings;
    }
    const jev = jevRecordings
      ? { recordings: jevRecordings, capabilities: remote.jev!.capabilities }
      : undefined;
    results[site.key]![arm] = await measureArm(site, arm, seed, jev);
    console.log(`[${site.key}] ${ARM_TITLE[arm]}: measured ${LEVELS.length} levels`);
  }
  if (site.key === "restaurant") {
    const rseed = Number(values["robustness-seed"]);
    robustness[site.key] = {};
    for (const arm of arms) {
      const recs = recorded[site.key]![arm];
      robustness[site.key]![arm] = await measureArm(
        site,
        arm,
        rseed,
        recs ? { recordings: recs, capabilities: remote.jev!.capabilities } : undefined,
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Verdict (pre-registered, design D6)
// ---------------------------------------------------------------------------------------------

const atZero = (site: string, arm: Arm, engine: "rules" | "jev") =>
  results[site]?.[arm]?.find(
    (r) => r.level === 0 && (engine === "rules" ? r.engine === "rules" : r.engine !== "rules"),
  );
const gap = (arm: Arm) => {
  const gaps = sites
    .map((s) => {
      const j = atZero(s.key, arm, "jev");
      const r = atZero(s.key, arm, "rules");
      return j && r ? j.decisionAccuracyAll - r.decisionAccuracyAll : null;
    })
    .filter((g): g is number => g !== null);
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
};
const gapH = arms.includes("h") ? gap("h") : null;
const gapHA = arms.includes("ha") ? gap("ha") : null;
const jevInvariantsHA = sites.map((s) => atZero(s.key, "ha", "jev")?.invariantPassRate ?? null);
const invariantsOk = jevInvariantsHA.every((v) => v !== null && v >= 0.99);
const complete = useJev && arms.includes("h") && arms.includes("ha") && siteKeys.length === 4;
const failingInvariants = sites
  .map((s, i) => ({ site: s.key, rate: jevInvariantsHA[i] }))
  .filter((x) => x.rate === null || x.rate < 0.99);
const pts1 = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)} points`);
const why = [
  `gap without heuristics or audiences ${pts1(gapHA)} (needs >= 10)`,
  `gap without heuristics ${pts1(gapH)}`,
  failingInvariants.length
    ? `Jev invariants below 99% at 0% without audiences on ${failingInvariants
        .map((x) => `${x.site} (${x.rate === null ? "n/a" : `${(x.rate * 100).toFixed(1)}%`})`)
        .join(", ")}`
    : "Jev invariants >= 99% on every site at 0% without audiences",
].join("; ");
// Pre-registered rules (design D6), applied literally.
const holds = gapHA !== null && gapHA >= 0.1 && invariantsOk;
const partially = !holds && gapH !== null && gapH >= 0.1 && !(gapHA !== null && gapHA >= 0.1);
const verdict = !useJev
  ? { outcome: "not-computed", reason: "Jev not measured (rules-only run)." }
  : holds
    ? {
        outcome: "holds",
        reason: `Descriptions beat rules: ${why}.`,
      }
    : partially
      ? {
          outcome: "holds-partially",
          reason: `Jev beats the rules by 10 points only while audiences are kept, so the headline must credit \`audience\`: ${why}.`,
        }
      : {
          outcome: "not-shown",
          reason: `The pre-registered conditions are not met: ${why}. Lead with cost, safety and explainability.`,
        };

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

const outDir = resolve(root, values.out!);
mkdirSync(outDir, { recursive: true });
const spendUsd = useJev ? (spentTokens / 1e6) * remote.jev!.capabilities.costPerMTok : 0;
const data = {
  generatedAt: new Date().toISOString(),
  engine: useJev ? (Object.values(recorded)[0]?.h?.engineVersion ?? remote.jev!.id) : "rules",
  seed,
  robustnessSeed: Number(values["robustness-seed"]),
  levels: LEVELS,
  arms: Object.fromEntries(arms.map((a) => [a, ARM_TITLE[a]])),
  complete,
  spend: { inputTokens: spentTokens, usd: spendUsd },
  verdict: {
    ...verdict,
    gapHeuristics: gapH,
    gapHeuristicsAndAudiences: gapHA,
    jevInvariantsAtZeroHA: Object.fromEntries(sites.map((s, i) => [s.key, jevInvariantsHA[i]])),
    rules:
      "gap = mean over sites, at 0% kept, of Jev's minus the rules' pooled decision accuracy. holds: gap(ha) >= 10 points and Jev invariants >= 99% on every site at 0% ha; holds-partially: gap(h) >= 10 points while gap(ha) < 10 points; otherwise not-shown.",
  },
  sites: Object.fromEntries(
    sites.map((s) => [
      s.key,
      {
        title: s.title,
        accounting: accounting(s),
        arms: results[s.key],
        ...(robustness[s.key] ? { robustness: robustness[s.key] } : {}),
      },
    ]),
  ),
};
writeFileSync(resolve(outDir, "data.json"), `${JSON.stringify(data, null, 2)}\n`);

const RULES_COLOR = "#dc2626";
const JEV_COLOR = "#2563eb";
const seriesFor = (site: string, metric: (r: LevelResult) => number | null): Series[] => {
  const out: Series[] = [];
  for (const arm of arms) {
    const rows = results[site]?.[arm] ?? [];
    const dashed = arm === "ha";
    out.push({
      name: `rules, ${ARM_TITLE[arm]}`,
      color: RULES_COLOR,
      dashed,
      points: LEVELS.map((l) => {
        const r = rows.find((x) => x.level === l && x.engine === "rules");
        return r ? metric(r) : null;
      }),
    });
    if (useJev)
      out.push({
        name: `Jev, ${ARM_TITLE[arm]}`,
        color: JEV_COLOR,
        dashed,
        points: LEVELS.map((l) => {
          const r = rows.find((x) => x.level === l && x.engine !== "rules");
          return r ? metric(r) : null;
        }),
      });
  }
  return out;
};
for (const s of sites) {
  writeFileSync(
    resolve(outDir, `${s.key}-relevance.svg`),
    lineChart(
      `${s.title}: relevance answers`,
      `Raw relevance accuracy of the rules engine and Jev as hand-written heuristics are removed, in two arms (audiences kept, solid; audiences removed, dashed).`,
      seriesFor(s.key, (r) => r.relevanceRaw),
    ),
  );
  writeFileSync(
    resolve(outDir, `${s.key}-decisions.svg`),
    lineChart(
      `${s.title}: what visitors get`,
      `Decision accuracy (labels scored against the final page) for the rules engine and the Jev pipeline as hand-written heuristics are removed.`,
      seriesFor(s.key, (r) => r.decisionAccuracyAll),
    ),
  );
}
const meanOver = (arm: Arm, engine: "rules" | "jev", level: number) => {
  const vals = sites
    .map((s) =>
      results[s.key]?.[arm]?.find(
        (r) =>
          r.level === level && (engine === "rules" ? r.engine === "rules" : r.engine !== "rules"),
      ),
    )
    .filter(Boolean)
    .map((r) => r!.decisionAccuracyAll);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};
const allSeries: Series[] = arms.flatMap((arm) => [
  {
    name: `rules, ${ARM_TITLE[arm]}`,
    color: RULES_COLOR,
    dashed: arm === "ha",
    points: LEVELS.map((l) => meanOver(arm, "rules", l)),
  },
  ...(useJev
    ? [
        {
          name: `Jev, ${ARM_TITLE[arm]}`,
          color: JEV_COLOR,
          dashed: arm === "ha",
          points: LEVELS.map((l) => meanOver(arm, "jev", l)),
        },
      ]
    : []),
]);
writeFileSync(
  resolve(outDir, "all-sites.svg"),
  lineChart(
    `All ${sites.length} sites: what visitors get`,
    "Mean decision accuracy across sites for the rules engine and the Jev pipeline as hand-written heuristics (and, dashed, audiences) are removed.",
    allSeries,
  ),
);

writeFileSync(resolve(outDir, "report.md"), renderMarkdown());
console.log(
  `\nWrote ${values.out}/report.md, data.json and ${sites.length * 2 + 1} charts. Jev spend this run: $${spendUsd.toFixed(3)}. Verdict: ${verdict.outcome}`,
);

function renderMarkdown(): string {
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "–" : `${(v * 100).toFixed(1)}%`;
  const pts = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)} points`);
  const L: string[] = [
    "# Heuristic ablation: descriptions vs hand-written rules",
    "",
    `Generated ${data.generatedAt} · engine ${data.engine} · seed ${seed} · Jev spend this run $${spendUsd.toFixed(3)}${complete ? "" : " · **partial run**"}`,
    "",
    "## Verdict",
    "",
    `**${verdict.outcome}.** ${verdict.reason}`,
    "",
    `- Gap with heuristics removed (audiences kept), at 0%: ${pts(gapH)}`,
    `- Gap with heuristics and audiences removed, at 0%: ${pts(gapHA)}`,
    `- Jev invariant pass rate at 0% without audiences: ${sites.map((s, i) => `${s.key} ${pct(jevInvariantsHA[i])}`).join(", ")}`,
    "",
    `Rules fixed before the data was seen: ${data.verdict.rules}`,
    "",
    "![All sites](all-sites.svg)",
    "",
    "## Method",
    "",
    "- **Two arms.** *Heuristics removed*: each site's hand-written heuristics are kept at 100%, 75%, 50%, 25% and 0%. *Heuristics and audiences removed*: the same, with every `audience` also removed. Descriptions (`what`, `not_for`, tags), defaults and business invariants (`mustInclude` / `mustExclude`) stay in both.",
    `- **Seeded, nested removal.** Heuristics are dropped in an order fixed by seed ${seed}; a heuristic kept at 25% is kept at every higher level. The restaurant is repeated with seed ${data.robustnessSeed}.`,
    "- **Record once, replay.** Heuristics never reach the model, so within an arm Jev answers the same questions at every level. Jev is recorded once per site and arm (3 repeats) and replayed for every level.",
    "- **Measurements.** *Raw accuracy*: labelled answers vs accepted values. *Decision accuracy*: labels scored against the final page after gating, defaults, invariants and fallbacks (what a visitor gets; for Jev this includes its rules fallback for uncalibrated kinds). *Invariants*: page properties every plan must satisfy.",
    "",
    "## Situation space",
    "",
    "| site | buckets | situations | fixtures | situations covered | sources | heuristics | audiences | description chars | naive rules for full coverage |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const s of sites) {
    const a = data.sites[s.key]!.accounting;
    L.push(
      `| ${s.key} | ${a.buckets} | ${a.situations.toLocaleString("en")} | ${a.fixtures} | ${a.situationsCovered} | ${a.sources} | ${a.heuristics} | ${a.audiences} | ${a.descriptionChars.toLocaleString("en")} | ${a.naiveRules.toLocaleString("en")} |`,
    );
  }
  L.push(
    "",
    "Situations are the product of declared labels per bucket (`language`: the languages the fixtures use); `unknown` is not counted, so this is a lower bound. Naive rules = situations × sources × 5 decisions.",
  );
  const table = (rows: LevelResult[]) => {
    const out = [
      "| kept | engine | relevance (raw) | relevance (decision) | all decisions | invariants |",
      "|---|---|---|---|---|---|",
    ];
    for (const r of rows)
      out.push(
        `| ${r.level * 100}% | ${r.engine} | ${pct(r.relevanceRaw)} | ${pct(r.relevanceDecision)} | ${pct(r.decisionAccuracyAll)} | ${pct(r.invariantPassRate)} |`,
      );
    return out;
  };
  for (const s of sites) {
    L.push("", `## ${s.title}`, "", `![decisions](${s.key}-decisions.svg)`, "");
    for (const arm of arms) {
      L.push(`### ${ARM_TITLE[arm]}`, "", ...table(results[s.key]![arm]!), "");
      const zero = results[s.key]![arm]!.filter((r) => r.level === 0 && r.invariantFailures.length);
      for (const r of zero) {
        L.push(`Invariant failures at 0% (${r.engine}):`, "");
        for (const f of r.invariantFailures.slice(0, 8)) L.push(`- \`${f.fixture}\`: ${f.detail}`);
        if (r.invariantFailures.length > 8) L.push(`- … ${r.invariantFailures.length - 8} more`);
        L.push("");
      }
    }
    if (robustness[s.key]) {
      L.push(`### Robustness: seed ${data.robustnessSeed}`, "");
      for (const arm of arms)
        L.push(`${ARM_TITLE[arm]}:`, "", ...table(robustness[s.key]![arm]!), "");
    }
  }
  return `${L.join("\n")}\n`;
}
