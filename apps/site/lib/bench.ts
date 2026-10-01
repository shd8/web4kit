/** web4-bench, read at build time from the repository (spec: site, benchmark page). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatasetMeta } from "@web4kit/bench/format";
import {
  CHALLENGE,
  type Entry,
  isSmallOpenEngine,
  jevBar,
  loadEntries,
  meetsChallenge,
  ranked,
} from "@web4kit/bench/leaderboard";

/** The site is built from apps/site; web4-bench is committed at the repository root. */
const BENCH_DIR = resolve(process.cwd(), "../../bench");
const DATA_DIR = resolve(BENCH_DIR, "data/v1");

export interface BenchView {
  dataset: DatasetMeta;
  entries: Array<{ entry: Entry; small: boolean; meets: boolean }>;
  bar?: Entry;
  maxWeightsGB: number;
}

export function benchView(): BenchView {
  const dataset = JSON.parse(
    readFileSync(resolve(DATA_DIR, "dataset.json"), "utf8"),
  ) as DatasetMeta;
  const entries = loadEntries(resolve(BENCH_DIR, "leaderboard"));
  return {
    dataset,
    entries: ranked(entries).map((entry) => ({
      entry,
      small: isSmallOpenEngine(entry),
      meets: meetsChallenge(entry, entries),
    })),
    bar: jevBar(entries, dataset.version),
    maxWeightsGB: CHALLENGE.maxWeightsGB,
  };
}
