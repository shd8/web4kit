/**
 * Export web4-bench from the conformance fixtures (spec: benchmark, design D4). Labels only: no
 * engine is called and no answer is written. The output is deterministic, so `check` can diff it.
 */
import type { ExpectedAnswer } from "@web4kit/conformance";
import { toWireQuestion } from "@web4kit/decider";
import type { ManifestSet } from "@web4kit/manifest";
import { buildQuestions } from "@web4kit/planner";
import {
  canonicalJson,
  DATASET_VERSION,
  type DatasetMeta,
  type Item,
  type Label,
  type Split,
  sha256,
  toJsonl,
} from "./format";
import { type BenchSite, itemId, SITES } from "./sites";

export const LICENSE = "MIT";

/** Data files by name (uncompressed text). `dataset.json` is derived from them. */
export interface Export {
  files: Record<string, string>;
  meta: DatasetMeta;
}

export const itemsFile = (site: string) => `${site}.items.jsonl`;
export const manifestsFile = (site: string) => `${site}.manifests.json`;

export function exportDataset(sites: BenchSite[] = SITES): Export {
  const files: Record<string, string> = {};
  const meta: DatasetMeta = {
    name: "web4-bench",
    version: DATASET_VERSION,
    contentHash: "",
    license: LICENSE,
    splits: {
      dev: { sites: [], items: 0, labels: 0 },
      test: { sites: [], items: 0, labels: 0 },
    },
    sites: {},
  };
  for (const site of sites) {
    const items = siteItems(site);
    const labels = items.reduce((n, i) => n + i.labels.length, 0);
    files[itemsFile(site.key)] = toJsonl(items);
    files[manifestsFile(site.key)] = `${JSON.stringify(manifestsToJson(site.manifests))}\n`;
    meta.sites[site.key] = { split: site.split, title: site.title, items: items.length, labels };
    const split = meta.splits[site.split];
    split.sites.push(site.key);
    split.items += items.length;
    split.labels += labels;
  }
  meta.contentHash = contentHash(files);
  return { files, meta };
}

export function contentHash(files: Record<string, string>): string {
  return sha256(
    Object.keys(files)
      .sort()
      .map((name) => `${name}\n${files[name]}`)
      .join("\n"),
  );
}

export function siteItems(site: BenchSite): Item[] {
  const items = site.fixtures().map((f): Item => {
    const qp = buildQuestions(site.manifests, f.situation, f.intent ? { intent: f.intent } : {});
    return {
      id: itemId(site.key, f.name),
      site: site.key,
      split: site.split,
      state: qp.state,
      questions: Object.fromEntries(
        Object.entries(qp.questions).map(([id, q]) => [id, toWireQuestion(q)]),
      ),
      labels: (f.expected ?? []).flatMap((e) => labelsFor(qp.index, e)),
      invariants: f.invariants,
      situation: f.situation,
      ...(f.intent ? { intent: f.intent } : {}),
    };
  });
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`duplicate item id ${item.id}`);
    ids.add(item.id);
  }
  return items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The question(s) a label scores, resolved exactly as the conformance runner does. */
function labelsFor(
  index: ReturnType<typeof buildQuestions>["index"],
  expected: ExpectedAnswer,
): Label[] {
  const ids = Object.entries(index)
    .filter(([, e]) => e.kind === expected.kind && e.sourceId === expected.source && !e.category)
    .map(([id]) => id);
  const base = { kind: expected.kind, source: expected.source, accept: expected.accept };
  return ids.length
    ? ids.map((questionId) => ({ questionId, ...base }))
    : [{ questionId: null, ...base }];
}

/** Back to the conformance suite's labels (one per expectation, as the fixture declared it). */
export function expectedFrom(labels: Label[]): ExpectedAnswer[] {
  const seen = new Set<string>();
  const out: ExpectedAnswer[] = [];
  for (const { kind, source, accept } of labels) {
    const key = canonicalJson({ kind, source, accept });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, source, accept });
  }
  return out;
}

/**
 * Manifests as JSON. Planning never fetches data, so each source's `fetch` is dropped; any other
 * function would be lost silently, so it is an error instead.
 */
export function manifestsToJson(manifests: ManifestSet): unknown {
  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "function") {
      if (/^sources\.\d+\.fetch$/.test(path)) return undefined;
      throw new Error(`manifests: cannot export the function at ${path}`);
    }
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}.${i}`));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, walk(v, path ? `${path}.${k}` : k)]),
      );
    return value;
  };
  return walk(manifests, "");
}

/** Rehydrate exported manifests for planning: every source gets a fetch that is never called. */
export function manifestsFromJson(json: unknown): ManifestSet {
  const m = json as ManifestSet;
  return {
    ...m,
    sources: m.sources.map((s) => ({
      ...s,
      fetch: async () => {
        throw new Error(`web4-bench: planning must not fetch (${s.id})`);
      },
    })),
  } as ManifestSet;
}

export const splitOf = (meta: DatasetMeta, site: string): Split => {
  const s = meta.sites[site];
  if (!s) throw new Error(`site ${site} is not in web4-bench ${meta.version}`);
  return s.split;
};
