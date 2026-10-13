/**
 * Heuristic ablation (OpenSpec change: launch-ablation). Does a calibrated System One model plan
 * good pages from descriptions alone, while a rules engine needs hand-written heuristics?
 *
 *   pnpm ablation                       # estimate the Jev spend, record nothing
 *   pnpm ablation --yes                 # record Jev once per site and arm, then replay
 *   options: --site restaurant|explorer|hotel|welcome|all  --arms h,ha  --seed 7
 *            --engines rules,jev  --record (force fresh recordings)  --out reports/ablation
 *
 *   pnpm ablation --study zero-config --engines rules,laya --yes   # harness check, free, no verdict
 *   pnpm ablation --study zero-config --engines rules,jev          # estimate, then --yes for the verdict
 *   (zero-config arms: f,z1,z0; OpenSpec change zero-config-ablation)
 *   pnpm ablation --study zero-config-z2 --engines rules,jev       # follow-up Z2 (arms f,z2)
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
  type DecisionPolicy,
  type EngineRun,
  type ExpectedAnswer,
  label,
  type Recordings,
  recordingKey,
  runEngine,
  type SituatedFixture,
} from "@web4kit/conformance";
import type { BucketSpec, Situation } from "@web4kit/context";
import { type Decider, estimateTokens, remoteEnginesFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import {
  type DataSourceManifest,
  type DataSourceManifestInput,
  deciderVersion,
  type ManifestSet,
  manifestVersion,
  sourceDeciderVersions,
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
    study: { type: "string", default: "main" },
    out: { type: "string" },
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

function withSources(
  m: ManifestSet,
  sources: DataSourceManifest[],
  purpose = m.purpose,
): ManifestSet {
  const { purpose: _purpose, ...rest } = m;
  return {
    ...rest,
    ...(purpose !== undefined ? { purpose } : {}),
    sources,
    version: manifestVersion(m.site, sources, m.components, purpose),
    deciderVersion: deciderVersion(m.site, sources, m.components, purpose),
    sourceDeciderVersions: sourceDeciderVersions(m.site, sources, m.components, purpose),
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
// Follow-up F1: placement labels (registered 2026-10-01, after the main study; design F1)
// ---------------------------------------------------------------------------------------------

/**
 * Placement labels written from the situation, the way the sites' invariants describe a good
 * page. Used only by `--study followup`; the main study's fixtures are frozen. Written after the
 * main study's results were known, which is why F1 is reported separately.
 */
const F1_LABELS: Record<string, (s: Situation) => ExpectedAnswer[]> = {
  explorer: (s) =>
    s.role === "ops-manager"
      ? [
          label.region("kpis", "hero", "primary"),
          label.region("late-shipments", "hero", "primary"),
          label.salience("late-shipments", "standard", "featured"),
        ]
      : s.role === "executive"
        ? [
            label.region("briefing", "hero"),
            label.region("kpis", "hero", "primary"),
            label.salience("briefing", "featured"),
          ]
        : s.role === "analyst"
          ? [
              label.region("on-time-trend", "hero", "primary"),
              label.region("supplier-status", "hero", "primary"),
            ]
          : [],
  hotel: (s) =>
    s.stayPhase === "in-house"
      ? [label.region("today", "hero"), label.salience("today", "featured")]
      : s.stayPhase === "arriving-today"
        ? [label.region("arrival-guide", "hero"), label.salience("arrival-guide", "featured")]
        : s.stayPhase === "researching"
          ? [label.region("hero-photos", "hero")]
          : [],
};
/** F1 rule, fixed before the run: holds iff gap(ha) >= 10 points and Jev invariants >= 99% on both sites. */
const F1_RULE =
  "gap = mean over the explorer and the hotel, at 0% kept with heuristics and audiences removed, of Jev's minus the rules' pooled decision accuracy. holds: gap >= 10 points and Jev invariants >= 99% on both sites; otherwise not-shown. The heuristics-only arm is reported but not part of the rule.";

// ---------------------------------------------------------------------------------------------
// Zero-config study (registered before any engine run; OpenSpec change zero-config-ablation)
// ---------------------------------------------------------------------------------------------

/** Site purpose sentences (design D3). They describe the site, never who a block is for. */
const ZC_PURPOSE: Record<string, string> = {
  restaurant: "Website of Casa Lumbre, a restaurant",
  explorer: "Internal dashboard for Meridian Supply's supply-chain data",
  hotel: "Website of Casa Ribeira, a boutique hotel in Porto",
  welcome: "Starter homepage of a new site built with web4kit",
};
type ZArm = "f" | "z1" | "z0" | "z2";
const ZC_ARMS: ZArm[] = ["f", "z1", "z0"];
/** Follow-up Z2 (registered after the zero-config verdict, before Z2 was run). */
const Z2_ARMS: ZArm[] = ["f", "z2"];
const ZC_ARM_TITLE: Record<ZArm, string> = {
  f: "F: full manifests",
  z1: "Z1: what only",
  z0: "Z0: pure (id and field names)",
  z2: "Z2: what, audience, include",
};
/** defineSource's defaults, with no default component: the first compatible one is used. */
const NEUTRAL_DEFAULT: DataSourceManifest["default"] = {
  include: true,
  salience: "standard",
  region: "primary",
  prominence: 1,
};
/** Pre-registered verdict rule (spec: Pre-registered zero-config verdict). */
const ZC_RULE =
  "accuracy = Jev's ungated pooled decision accuracy, averaged across the four sites. holds: Z0 accuracy >= 90%, at most 5 points below F, and Z0 invariants >= 99% on every site. holds-with-one-line: Z0 fails that test and Z1 passes it. not-shown: neither passes.";
/**
 * Z2 rule, fixed before Z2 was run. Relative to F: the zero-config rule's absolute 99% invariant
 * bar is failed by F itself on the explorer (95.7%), so it cannot tell a sufficient manifest apart.
 */
const Z2_RULE =
  "Jev ungated, per site: accuracy = pooled decision accuracy, invariants = invariant pass rate. holds: on every site, Z2 accuracy and Z2 invariants are each at most 2 points below F's. holds-on-average: not holds, but Z2's accuracy and invariants averaged across the four sites are each at most 2 points below F's. not-shown: otherwise.";

const humanise = (id: string) => {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Z0's `what` (design D2): built mechanically from the id and the owner and system field paths.
 * Third-party field names never reach a decider, so they are left out.
 */
function standIn(source: DataSourceManifest): string {
  const paths = [
    ...new Set(
      Object.values(source.fields)
        .filter((f) => f.trust !== "third-party")
        .map((f) => f.path),
    ),
  ];
  const text = paths.length ? `${humanise(source.id)}: ${paths.join(", ")}` : humanise(source.id);
  return text.slice(0, 160);
}

/** Arm transforms (design D2). F is the site unchanged. */
function zeroConfigArm(site: Site, arm: ZArm): ManifestSet {
  const m = site.manifests;
  if (arm === "f") return m;
  const sources = m.sources.map((s) => {
    const { not_for: _notFor, audience: _audience, ...kept } = s;
    return {
      ...kept,
      what: arm === "z0" ? standIn(s) : s.what,
      // Z2 keeps who/when a source is for and whether it is shown by default; nothing else.
      ...(arm === "z2" && s.audience ? { audience: s.audience } : {}),
      tags: [],
      heuristics: [],
      default: { ...NEUTRAL_DEFAULT, ...(arm === "z2" ? { include: s.default.include } : {}) },
    } satisfies DataSourceManifestInput as DataSourceManifest;
  });
  return withSources(m, sources, ZC_PURPOSE[site.key]);
}

interface ZRow {
  arm: ZArm;
  /** rules, jev or laya. */
  engineKey: string;
  engine: string;
  policy: DecisionPolicy;
  rawAccuracy: Record<string, { samples: number; accuracy: number }>;
  relevanceRaw: number | null;
  decisionAccuracy: Record<string, { samples: number; accuracy: number }>;
  decisionAccuracyAll: number;
  invariantPassRate: number;
  invariantFailures: EngineRun["invariantFailures"];
}

const zRow = (arm: ZArm, engineKey: string, policy: DecisionPolicy, run: EngineRun): ZRow => {
  const r = summarise(1, run.engineVersion, run);
  return {
    arm,
    engineKey,
    engine: run.engine === "rules" ? "rules" : run.engineVersion,
    policy,
    rawAccuracy: r.rawAccuracy,
    relevanceRaw: r.relevanceRaw,
    decisionAccuracy: r.decisionAccuracy,
    decisionAccuracyAll: r.decisionAccuracyAll,
    invariantPassRate: r.invariantPassRate,
    invariantFailures: r.invariantFailures,
  };
};

/** Grouped bars: one group per site plus the mean, one bar per arm (0..1). */
function barChart(title: string, description: string, groups: string[], bars: Series[]): string {
  const W = 640;
  const H = 360;
  const m = { top: 48, right: 24, bottom: 88, left: 56 };
  const w = W - m.left - m.right;
  const h = H - m.top - m.bottom;
  const y = (v: number) => m.top + h - v * h;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const gw = w / groups.length;
  const bw = Math.min(28, (gw - 16) / bars.length);
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (v) =>
        `<line x1="${m.left}" x2="${m.left + w}" y1="${y(v)}" y2="${y(v)}" stroke="#d4d4d8" stroke-width="1"/>` +
        `<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="#52525b">${v * 100}%</text>`,
    )
    .join("");
  const rects = groups
    .map((g, gi) => {
      const x0 = m.left + gi * gw + (gw - bw * bars.length) / 2;
      const cols = bars
        .map((b, bi) => {
          const v = b.points[gi];
          if (v === null || v === undefined) return "";
          return `<rect x="${(x0 + bi * bw).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${(m.top + h - y(v)).toFixed(1)}" fill="${b.color}"/>`;
        })
        .join("");
      return `${cols}<text x="${(m.left + gi * gw + gw / 2).toFixed(1)}" y="${m.top + h + 20}" text-anchor="middle" font-size="12" fill="#52525b">${esc(g)}</text>`;
    })
    .join("");
  const legend = bars
    .map((b, i) => {
      const lx = m.left + i * 190;
      const ly = m.top + h + 56;
      return `<rect x="${lx}" y="${ly - 10}" width="12" height="12" fill="${b.color}"/><text x="${lx + 18}" y="${ly}" font-size="12" fill="#27272a">${esc(b.name)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" font-family="Inter, system-ui, sans-serif">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(description)}</desc>
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${m.left}" y="28" font-size="15" font-weight="600" fill="#18181b">${esc(title)}</text>
${grid}${rects}${legend}
</svg>
`;
}

const z2Study = values.study === "zero-config-z2";
if (values.study === "zero-config" || z2Study) {
  const studyArms = z2Study ? Z2_ARMS : ZC_ARMS;
  const zcSites = (values.site === "all" ? Object.keys(SITES) : values.site!.split(",")).map(
    (k) => {
      const make = SITES[k];
      if (!make) throw new Error(`unknown site ${k}`);
      return make();
    },
  );
  const zcArms = (values.arms === "h,ha" ? studyArms.join(",") : values.arms!).split(",") as ZArm[];
  for (const a of zcArms) if (!studyArms.includes(a)) throw new Error(`unknown arm ${a}`);
  const zcEngines = values.engines!.split(",");
  for (const e of zcEngines)
    if (!["rules", "jev", "laya"].includes(e)) throw new Error(`unknown engine ${e}`);
  const zRemote = remoteEnginesFromEnv();
  if (zcEngines.includes("jev") && !zRemote.jev) {
    console.error("JEV_API_KEY is not set (use --engines rules,laya to run without Jev)");
    process.exit(1);
  }
  const LAYA_ID = "laya-onnx@68f27dfe5a27"; // createInProcessLayaDecider's id for the pinned revision
  const LAYA_SECONDS_PER_SET = 10; // docs/engines.md: ~10 s per new situation on a laptop CPU
  const models = zcEngines.filter((e) => e !== "rules");
  const engineId = (e: string) => (e === "jev" ? zRemote.jev!.id : LAYA_ID);
  const repeatsOf = (e: string) => (e === "jev" ? 3 : 1); // Laya is deterministic
  // F asks exactly the main study's arm-h questions (heuristics never reach a decider).
  const fileFor = (site: string, arm: ZArm, e: string) =>
    recordingFile(site, (arm === "f" ? "h" : arm) as Arm, engineId(e));

  // What would be recorded: Jev's cost, Laya's time. Nothing runs without --yes.
  for (const e of models) {
    let tokens = 0;
    let sets = 0;
    for (const site of zcSites) {
      for (const arm of zcArms) {
        const previous =
          values.record && arm !== "f" ? undefined : loadRecordings(fileFor(site.key, arm, e));
        const manifests = zeroConfigArm(site, arm);
        for (const f of site.fixtures) {
          const qp = buildQuestions(manifests, f.situation, f.intent ? { intent: f.intent } : {});
          const have = previous?.sets[recordingKey(qp.state, qp.questions)]?.length ?? 0;
          const missing = Math.max(0, repeatsOf(e) - have);
          sets += missing;
          tokens += missing * (estimateTokens(qp.questions) + estimateTokens(qp.state));
        }
      }
    }
    if (e === "jev") {
      const usd = (tokens / 1e6) * zRemote.jev!.capabilities.costPerMTok;
      console.log(
        `Jev: ${sets} question sets to record, ~${Math.round(tokens).toLocaleString("en")} input tokens, ~$${usd.toFixed(2)}`,
      );
    } else {
      console.log(
        `Laya: ${sets} question sets to record, $0, roughly ${((sets * LAYA_SECONDS_PER_SET) / 3600).toFixed(1)} h of CPU`,
      );
    }
  }
  if (!values.yes) {
    console.log("Nothing was run. Re-run with --yes (also when the estimate is $0).");
    process.exit(0);
  }

  mkdirSync(cacheDir, { recursive: true });
  let layaDecider: Promise<Decider & { close(): Promise<void> }> | undefined;
  /** In-process Laya is loaded once, on first use. */
  const deciderOf = (e: string): Promise<Decider> => {
    if (e === "jev") return Promise.resolve(zRemote.jev!);
    layaDecider ??= import("@web4kit/decider-laya").then((m) => m.createInProcessLayaDecider());
    return layaDecider;
  };
  let zcSpentTokens = 0;
  const zResults: Record<string, ZRow[]> = {};

  for (const site of zcSites) {
    const rows: ZRow[] = [];
    for (const arm of zcArms) {
      const manifests = zeroConfigArm(site, arm);
      for (const policy of ["ungated", "self-calibrated"] as const) {
        const rules = await runEngine({
          manifests,
          fixtures: site.fixtures,
          decider: createManifestRuleDecider(manifests),
          decisions: policy,
        });
        rows.push(zRow(arm, "rules", policy, rules));
      }
      for (const e of models) {
        const file = fileFor(site.key, arm, e);
        const previous = values.record && arm !== "f" ? undefined : loadRecordings(file);
        const inner = await deciderOf(e);
        const resume = resumingDecider(inner, previous);
        const save = () => {
          // F's file belongs to the main study: only write it when something new was recorded.
          if (resume.spentTokens() > 0 || arm !== "f" || !previous)
            writeFileSync(file, JSON.stringify(resume.merged()));
        };
        let calibrated: EngineRun;
        try {
          calibrated = await runEngine({
            manifests,
            fixtures: site.fixtures,
            decider: resume.decider,
            repeats: repeatsOf(e),
            decisions: "self-calibrated",
            // Checkpoint long runs (Laya takes hours) so an interruption loses little.
            onProgress: (done) => {
              if (done % 25 === 0) save();
            },
          });
        } catch (err) {
          save();
          zcSpentTokens += e === "jev" ? resume.spentTokens() : 0;
          if (e === "jev" && isCreditOrAuth(err)) {
            console.error(
              `\nJev refused a request (${err instanceof Error ? err.message : err}).\nRecorded so far is kept in ${cacheDir}; re-run to resume from ${site.key}/${arm}.`,
            );
            process.exit(2);
          }
          throw err;
        }
        save();
        zcSpentTokens += e === "jev" ? resume.spentTokens() : 0;
        const ungated = await runEngine({
          manifests,
          fixtures: site.fixtures,
          decider: createReplayDecider(resume.merged(), inner.capabilities),
          repeats: repeatsOf(e),
          decisions: "ungated",
        });
        rows.push(zRow(arm, e, "ungated", ungated), zRow(arm, e, "self-calibrated", calibrated));
      }
      console.log(`[${site.key}] ${ZC_ARM_TITLE[arm]}: measured`);
    }
    zResults[site.key] = rows;
  }
  await layaDecider?.then((d) => d.close());

  // Verdict (pre-registered): Jev, ungated only.
  const useJevZ = models.includes("jev");
  const verdictEngine = useJevZ ? "jev" : (models[0] ?? "rules");
  const pick = (site: string, arm: ZArm, engineKey: string) =>
    zResults[site]?.find(
      (r) => r.arm === arm && r.policy === "ungated" && r.engineKey === engineKey,
    );
  const accuracyOf = (arm: ZArm) => {
    const v = zcSites
      .map((s) => pick(s.key, arm, verdictEngine)?.decisionAccuracyAll)
      .filter((x): x is number => x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const invariantsOf = (arm: ZArm) =>
    Object.fromEntries(
      zcSites.map((s) => [s.key, pick(s.key, arm, verdictEngine)?.invariantPassRate ?? null]),
    );
  const accF = accuracyOf("f");
  const passes = (arm: ZArm) => {
    const acc = accuracyOf(arm);
    return (
      acc !== null &&
      accF !== null &&
      acc >= 0.9 &&
      acc >= accF - 0.05 &&
      Object.values(invariantsOf(arm)).every((v) => v !== null && v >= 0.99)
    );
  };
  const zcComplete =
    useJevZ &&
    zcSites.length === Object.keys(SITES).length &&
    studyArms.every((a) => zcArms.includes(a));
  const pctZ = (v: number | null | undefined) =>
    v === null || v === undefined ? "–" : `${(v * 100).toFixed(1)}%`;
  const numbers = zcArms.map((a) => `${a.toUpperCase()} ${pctZ(accuracyOf(a))}`).join(", ");
  const mean = (xs: (number | null)[]) =>
    xs.every((x) => x !== null) ? (xs as number[]).reduce((a, b) => a + b, 0) / xs.length : null;
  const invMean = (arm: ZArm) => mean(Object.values(invariantsOf(arm)));
  const within2 = (a: number | null | undefined, f: number | null | undefined) =>
    a !== null && a !== undefined && f !== null && f !== undefined && a >= f - 0.02;
  const z2Numbers = `accuracy F ${pctZ(accF)}, Z2 ${pctZ(accuracyOf("z2"))}; invariants F ${pctZ(invMean("f"))}, Z2 ${pctZ(invMean("z2"))}`;
  const z2Misses = zcSites.flatMap((s) => {
    const f = pick(s.key, "f", verdictEngine);
    const z = pick(s.key, "z2", verdictEngine);
    return [
      ...(within2(z?.decisionAccuracyAll, f?.decisionAccuracyAll) ? [] : [`${s.key} accuracy`]),
      ...(within2(z?.invariantPassRate, f?.invariantPassRate) ? [] : [`${s.key} invariants`]),
    ];
  });
  const zVerdict = !useJevZ
    ? { outcome: "not-computed", reason: "Harness check, no verdict: Jev was not measured." }
    : !zcComplete
      ? {
          outcome: "not-computed",
          reason: `Partial run (needs all four sites and arms): ${numbers}.`,
        }
      : z2Study
        ? !z2Misses.length
          ? { outcome: "holds", reason: `Z2 is within 2 points of F on every site: ${z2Numbers}.` }
          : within2(accuracyOf("z2"), accF) && within2(invMean("z2"), invMean("f"))
            ? {
                outcome: "holds-on-average",
                reason: `Within 2 points of F on average, not on ${z2Misses.join(", ")}: ${z2Numbers}.`,
              }
            : {
                outcome: "not-shown",
                reason: `More than 2 points below F (${z2Misses.join(", ")}): ${z2Numbers}.`,
              }
        : passes("z0")
          ? { outcome: "holds", reason: `Zero config plans acceptable pages: ${numbers}.` }
          : passes("z1")
            ? {
                outcome: "holds-with-one-line",
                reason: `Pages need each source's one-line \`what\`, not more: ${numbers}.`,
              }
            : { outcome: "not-shown", reason: `Neither zero-config arm passes: ${numbers}.` };

  const zOutRel =
    values.out ??
    (useJevZ ? `reports/ablation/${values.study}` : `.w4-cache/ablation/${values.study}-check`);
  const zOut = resolve(root, zOutRel);
  mkdirSync(zOut, { recursive: true });
  const zEngineName =
    verdictEngine === "jev" ? zRemote.jev!.id : verdictEngine === "laya" ? LAYA_ID : "rules";
  const zData = {
    generatedAt: new Date().toISOString(),
    study: values.study,
    harnessCheck: !useJevZ,
    engines: zcEngines.map((e) => (e === "rules" ? "rules" : engineId(e))),
    arms: Object.fromEntries(zcArms.map((a) => [a, ZC_ARM_TITLE[a]])),
    purposes: Object.fromEntries(zcSites.map((s) => [s.key, ZC_PURPOSE[s.key]])),
    complete: zcComplete,
    spend: {
      thisRun: {
        inputTokens: zcSpentTokens,
        usd: useJevZ ? (zcSpentTokens / 1e6) * zRemote.jev!.capabilities.costPerMTok : 0,
      },
    },
    verdict: {
      ...zVerdict,
      engine: zEngineName,
      accuracy: Object.fromEntries(zcArms.map((a) => [a, accuracyOf(a)])),
      invariants: Object.fromEntries(zcArms.map((a) => [a, invariantsOf(a)])),
      rule: z2Study ? Z2_RULE : ZC_RULE,
    },
    sites: Object.fromEntries(
      zcSites.map((s) => [
        s.key,
        {
          title: s.title,
          standIns: Object.fromEntries(s.manifests.sources.map((src) => [src.id, standIn(src)])),
          rows: zResults[s.key],
        },
      ]),
    ),
  };
  writeFileSync(resolve(zOut, "data.json"), `${JSON.stringify(zData, null, 2)}\n`);

  const ARM_COLOR: Record<ZArm, string> = {
    f: "#2563eb",
    z1: "#16a34a",
    z0: "#d97706",
    z2: "#7c3aed",
  };
  const groups = [...zcSites.map((s) => s.key), "mean"];
  writeFileSync(
    resolve(zOut, "all-sites.svg"),
    barChart(
      `${useJevZ ? "Zero config" : "Zero config (harness check)"}: what visitors get, ${zEngineName} ungated`,
      `Ungated decision accuracy per site for ${zcArms.map((a) => ZC_ARM_TITLE[a]).join(", ")}, planned by ${zEngineName}.`,
      groups,
      zcArms.map((a) => ({
        name: ZC_ARM_TITLE[a],
        color: ARM_COLOR[a],
        points: [
          ...zcSites.map((s) => pick(s.key, a, verdictEngine)?.decisionAccuracyAll ?? null),
          accuracyOf(a),
        ],
      })),
    ),
  );

  const L: string[] = [
    z2Study
      ? `# Zero-config follow-up Z2: is what, audience and include enough?${useJevZ ? "" : " (harness check, no verdict)"}`
      : useJevZ
        ? "# Zero-config ablation: how much does the developer need to write?"
        : "# Zero-config ablation: harness check, no verdict",
    "",
    ...(z2Study
      ? [
          "> Registered after the [zero-config study](../zero-config/report.md) (verdict: not-shown) was known, and before Z2 was run. Reported separately; it never changes that verdict.",
          "",
        ]
      : []),
    ...(useJevZ
      ? []
      : [
          `> Planned with ${zEngineName}, not Jev. These numbers check the pipeline${verdictEngine === "laya" ? " and show how a small engine copes with thin descriptions" : ""}. They are not the study's result.`,
          "",
        ]),
    `Generated ${zData.generatedAt} · engines ${zData.engines.join(", ")} · Jev spent this run $${zData.spend.thisRun.usd.toFixed(3)}${zcComplete || !useJevZ ? "" : " · **partial run**"}`,
    "",
    "## Verdict",
    "",
    `**${zVerdict.outcome}.** ${zVerdict.reason}`,
    "",
    z2Study
      ? `Rule fixed before Z2 was run: ${Z2_RULE}`
      : `Rule fixed before any engine was run: ${ZC_RULE}`,
    "",
    "![All sites](all-sites.svg)",
    "",
    "## Method",
    "",
    "- **F (full):** the site's manifests unchanged.",
    "- **Z1 (what only):** each source keeps its `what`. `not_for`, tags, `audience` and heuristics are removed, defaults become neutral (included, standard, primary, noticeable, first compatible component), and the site gets one purpose sentence.",
    ...(z2Study
      ? [
          "- **Z2 (what, audience, include):** as Z1, but each source keeps its `audience` and its default `include`. `not_for`, tags and heuristics are removed; salience, region, prominence and component defaults are neutral.",
        ]
      : [
          "- **Z0 (pure):** as Z1, but `what` is replaced by the humanised source id and its owner and system field paths. No owner-written text.",
        ]),
    "- **Kept in every arm:** `mustInclude` / `mustExclude` (business rules can't be inferred) and the site's situation rules, which a developer still writes.",
    "- **Ungated:** decisions use the engine's answers directly, with no calibration profile (provisional trust). Self-calibrated numbers, gated by a profile measured on the same fixtures, are shown beside them. The verdict uses ungated numbers only.",
    "- **Bias:** the fixtures and labels were written against the full manifests, so F has a home advantage.",
    "",
    "| site | purpose |",
    "|---|---|",
    ...zcSites.map((s) => `| ${s.key} | ${ZC_PURPOSE[s.key]} |`),
  ];
  for (const s of zcSites) {
    L.push(
      "",
      `## ${s.title}`,
      "",
      "| arm | engine | policy | relevance (raw) | all decisions | invariants |",
      "|---|---|---|---|---|---|",
    );
    for (const r of zResults[s.key]!)
      L.push(
        `| ${r.arm.toUpperCase()} | ${r.engine} | ${r.policy} | ${pctZ(r.relevanceRaw)} | ${pctZ(r.decisionAccuracyAll)} | ${pctZ(r.invariantPassRate)} |`,
      );
    if (zcArms.includes("z0")) {
      L.push("", "Z0 descriptions:", "");
      for (const src of s.manifests.sources) L.push(`- \`${src.id}\`: ${standIn(src)}`);
    }
    for (const r of zResults[s.key]!.filter(
      (x) => x.policy === "ungated" && x.engineKey !== "rules" && x.invariantFailures.length,
    )) {
      L.push("", `Invariant failures (${r.arm.toUpperCase()}, ${r.engine}, ungated):`, "");
      for (const f of r.invariantFailures.slice(0, 8)) L.push(`- \`${f.fixture}\`: ${f.detail}`);
      if (r.invariantFailures.length > 8) L.push(`- … ${r.invariantFailures.length - 8} more`);
    }
  }
  writeFileSync(resolve(zOut, "report.md"), `${L.join("\n")}\n`);
  console.log(
    `\nWrote ${zOutRel}/report.md, data.json and all-sites.svg. Jev spend this run: $${zData.spend.thisRun.usd.toFixed(3)}. Verdict: ${zVerdict.outcome}`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------

const followup = values.study === "followup";
if (!followup && values.study !== "main") throw new Error(`unknown study ${values.study}`);
if (values.engines!.split(",").some((e) => e !== "rules" && e !== "jev"))
  throw new Error(
    "the main and follow-up studies take --engines rules,jev (laya: --study zero-config)",
  );
const siteKeys = followup
  ? Object.keys(F1_LABELS)
  : values.site === "all"
    ? Object.keys(SITES)
    : values.site!.split(",");
const outRel =
  values.out ?? (followup ? "reports/ablation/followup-placement" : "reports/ablation");
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
  const site = make();
  if (!followup) return site;
  const extra = F1_LABELS[k]!;
  return {
    ...site,
    fixtures: site.fixtures.map((f) =>
      // Typed-question fixtures are judged by their question, not their role: no F1 labels.
      f.intent ? f : { ...f, expected: [...(f.expected ?? []), ...extra(f.situation)] },
    ),
  };
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
  if (!values.yes) {
    console.log("Nothing was run. Re-run with --yes (also when the estimate is $0).");
    process.exit(0);
  }
}

if (!useJev && !values.yes) {
  console.log("Nothing was run. Re-run with --yes.");
  process.exit(0);
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
const complete =
  useJev &&
  arms.includes("h") &&
  arms.includes("ha") &&
  siteKeys.length === (followup ? Object.keys(F1_LABELS).length : 4);
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
// F1 has no "partially" outcome (design F1).
const partially =
  !followup && !holds && gapH !== null && gapH >= 0.1 && !(gapHA !== null && gapHA >= 0.1);
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

const outDir = resolve(root, outRel);
mkdirSync(outDir, { recursive: true });
const spendUsd = useJev ? (spentTokens / 1e6) * remote.jev!.capabilities.costPerMTok : 0;
// What recording cost in total, from the token usage stored with every recorded answer set.
const recordedTokens = Object.values(recorded)
  .flatMap((arms) => Object.values(arms))
  .flatMap((r) => Object.values(r.sets).flat())
  .reduce((n, set) => n + set.usage.inputTokens, 0);
const recordedUsd = useJev ? (recordedTokens / 1e6) * remote.jev!.capabilities.costPerMTok : 0;
const data = {
  generatedAt: new Date().toISOString(),
  engine: useJev ? (Object.values(recorded)[0]?.h?.engineVersion ?? remote.jev!.id) : "rules",
  seed,
  robustnessSeed: Number(values["robustness-seed"]),
  levels: LEVELS,
  arms: Object.fromEntries(arms.map((a) => [a, ARM_TITLE[a]])),
  complete,
  spend: {
    thisRun: { inputTokens: spentTokens, usd: spendUsd },
    recordings: { inputTokens: recordedTokens, usd: recordedUsd },
  },
  verdict: {
    ...verdict,
    gapHeuristics: gapH,
    gapHeuristicsAndAudiences: gapHA,
    jevInvariantsAtZeroHA: Object.fromEntries(sites.map((s, i) => [s.key, jevInvariantsHA[i]])),
    rules: followup
      ? F1_RULE
      : "gap = mean over sites, at 0% kept, of Jev's minus the rules' pooled decision accuracy. holds: gap(ha) >= 10 points and Jev invariants >= 99% on every site at 0% ha; holds-partially: gap(h) >= 10 points while gap(ha) < 10 points; otherwise not-shown.",
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
  `\nWrote ${outRel}/report.md, data.json and ${sites.length * 2 + 1} charts. Jev spend this run: $${spendUsd.toFixed(3)}. Verdict: ${verdict.outcome}`,
);

function renderMarkdown(): string {
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "–" : `${(v * 100).toFixed(1)}%`;
  const pts = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)} points`);
  const L: string[] = [
    followup
      ? "# Ablation follow-up F1: placement labels"
      : "# Heuristic ablation: descriptions vs hand-written rules",
    "",
    ...(followup
      ? [
          "> Registered after the main study (see [the main report](../report.md)) and reported separately; it never changes the main verdict. It adds region and salience labels for the explorer and the hotel and replays the main study's Jev recordings, so no new engine answers were sampled.",
          ">",
          "> Disclosure: one run happened by mistake before the registration was committed (a $0 dry run did not stop for confirmation). Only its one-line verdict (not-shown) was seen; the labels and the rule were not changed afterwards.",
          "",
        ]
      : existsSync(resolve(root, "reports/ablation/followup-placement/report.md"))
        ? [
            "> A follow-up registered after this study tests the explorer's failure cause: [F1, placement labels](followup-placement/report.md).",
            "",
          ]
        : []),
    `Generated ${data.generatedAt} · engine ${data.engine} · seed ${seed} · Jev spent on recordings $${recordedUsd.toFixed(2)} (${recordedTokens.toLocaleString("en")} input tokens; this run $${spendUsd.toFixed(3)})${complete ? "" : " · **partial run**"}`,
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
