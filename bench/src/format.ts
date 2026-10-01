/**
 * web4-bench file formats (spec: benchmark). Everything an engine sees is in the System One wire
 * format; everything web4 needs to replay the planning pipeline travels alongside it.
 */
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { Invariant } from "@web4kit/conformance";
import type { Situation } from "@web4kit/context";
import type { State } from "@web4kit/decider";

export const DATASET_VERSION = "v1";
export type Split = "dev" | "test";

/** One labelled expectation, tied to the question that asks it. */
export interface Label {
  /** The question whose answer is scored; null when the source is not asked about here. */
  questionId: string | null;
  kind: string;
  source: string;
  /** Accepted values: option labels for choices, booleans for nouls, level indices for scores. */
  accept: Array<string | number | boolean>;
}

/** One benchmark item: a visitor situation on one site, as an engine receives it. */
export interface Item {
  id: string;
  site: string;
  split: Split;
  /** Exactly what is sent to the engine (System One wire format). */
  state: State;
  questions: Record<string, Record<string, unknown>>;
  labels: Label[];
  invariants: Invariant[];
  /** For replaying the pipeline: the situation and intent the questions were built from. */
  situation: Situation;
  intent?: { text: string; language: string };
}

export interface DatasetMeta {
  name: "web4-bench";
  version: string;
  /** sha256 of every data file's uncompressed bytes, in file-name order. */
  contentHash: string;
  license: string;
  splits: Record<Split, { sites: string[]; items: number; labels: number }>;
  sites: Record<string, { split: Split; title: string; items: number; labels: number }>;
}

/** A raw answer in the System One wire format. */
export interface WireAnswer {
  type: "choice" | "score" | "noul";
  choice?: string;
  score?: number;
  noul?: number;
  probabilities?: Record<string, number>;
}

export interface SubmissionMeta {
  engine: string;
  engineVersion: string;
  dataset: string;
  repeats: number;
  openWeights: boolean;
  /** Size of the weights in GB; null for hosted engines that don't publish it. */
  weightsGB: number | null;
  offline: boolean;
  trainingData: string;
  createdAt: string;
  notes?: string;
}

/** One answered item and repeat. */
export interface SubmissionLine {
  item: string;
  repeat: number;
  answers: Record<string, WireAnswer>;
  inputTokens?: number;
  latencyMs?: number;
}

export interface Submission {
  meta: SubmissionMeta;
  lines: SubmissionLine[];
}

/**
 * JSON with sorted object keys, for comparing values. Data files keep insertion order instead:
 * key order is meaningful there (choice options, audience clauses) and the export is
 * deterministic because the same code builds every object in the same order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export const gzip = (text: string) => gzipSync(Buffer.from(text, "utf8"), { level: 9 });
export const gunzip = (buf: Buffer) => gunzipSync(buf).toString("utf8");
export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export const toJsonl = (rows: unknown[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join("");
export const fromJsonl = <T>(text: string): T[] =>
  text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);

/** Submissions are JSONL (optionally gzipped): a `{"meta": …}` line, then one line per answer set. */
export function serialiseSubmission(s: Submission): string {
  const lines = [...s.lines].sort((a, b) =>
    a.item === b.item ? a.repeat - b.repeat : a.item < b.item ? -1 : 1,
  );
  return toJsonl([{ meta: s.meta }, ...lines]);
}
export function parseSubmission(text: string): Submission {
  const [head, ...rest] = fromJsonl<{ meta?: SubmissionMeta } & SubmissionLine>(text);
  if (!head?.meta) throw new Error('submission: the first line must be {"meta": …}');
  return { meta: head.meta, lines: rest };
}
