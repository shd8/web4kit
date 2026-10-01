/**
 * The leaderboard (spec: benchmark, design D7): one JSON file per engine version. The challenge
 * flag is computed from the fixed criteria every time it is read, never stored.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzip, parseSubmission, type Submission } from "./format";
import type { Score } from "./score";

/** bench/leaderboard (a function: bundlers such as Next's don't provide import.meta.dirname). */
export const leaderboardDir = () => resolve(import.meta.dirname, "../leaderboard");

export interface Entry {
  id: string;
  /** True when the submission is committed (re-scored in CI); false for reported-only entries. */
  published: boolean;
  submission?: string;
  /** When the answers were produced. */
  measuredAt: string;
  score: Score;
}

/** The small-engine challenge (fixed criteria): open weights, at most 2 GB, offline. */
export const CHALLENGE = { maxWeightsGB: 2 } as const;

export function isSmallOpenEngine(e: Entry): boolean {
  const m = e.score.submission;
  return (
    m.engine !== "rules" &&
    m.openWeights &&
    m.offline &&
    m.weightsGB !== null &&
    m.weightsGB <= CHALLENGE.maxWeightsGB
  );
}

export const isJev = (e: Entry) => /^jev/i.test(e.score.submission.engineVersion);

/** The best Jev entry at the same dataset version: the bar the challenge sets. */
export function jevBar(entries: Entry[], dataset: string): Entry | undefined {
  return entries
    .filter((e) => isJev(e) && e.score.dataset.version === dataset)
    .sort((a, b) => b.score.splits.test.decisionAccuracy - a.score.splits.test.decisionAccuracy)[0];
}

export function meetsChallenge(e: Entry, entries: Entry[]): boolean {
  const bar = jevBar(entries, e.score.dataset.version);
  if (!bar || !isSmallOpenEngine(e)) return false;
  const mine = e.score.splits.test;
  const theirs = bar.score.splits.test;
  return (
    mine.decisionAccuracy >= theirs.decisionAccuracy &&
    mine.invariantPassRate >= theirs.invariantPassRate
  );
}

export function loadEntries(dir: string = leaderboardDir()): Entry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => JSON.parse(readFileSync(resolve(dir, n), "utf8")) as Entry);
}

export function loadSubmission(file: string): Submission {
  const buf = readFileSync(file);
  return parseSubmission(file.endsWith(".gz") ? gunzip(buf) : buf.toString("utf8"));
}

/** Ranked by test-split decision accuracy, then invariants. */
export function ranked(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) =>
      b.score.splits.test.decisionAccuracy - a.score.splits.test.decisionAccuracy ||
      b.score.splits.test.invariantPassRate - a.score.splits.test.invariantPassRate,
  );
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function renderLeaderboard(entries: Entry[]): string {
  const rows = ranked(entries).map((e) => {
    const m = e.score.submission;
    const t = e.score.splits.test;
    const d = e.score.splits.dev;
    return `| ${m.engineVersion} | ${pct(t.decisionAccuracy)} | ${pct(t.rawAccuracy)} | ${pct(t.invariantPassRate)} | ${pct(d.decisionAccuracy)} | ${m.openWeights ? "yes" : "no"} | ${m.weightsGB ?? "n/a"} | ${e.published ? "re-scored in CI" : "reported only"} | ${meetsChallenge(e, entries) ? "✓" : "–"} |`;
  });
  return [
    "| engine | test decision | test raw | test invariants | dev decision | open weights | weights (GB) | answers | challenge |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
