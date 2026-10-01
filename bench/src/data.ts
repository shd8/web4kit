/** Reading and writing web4-bench on disk: `<dir>/dataset.json` plus gzipped data files. */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ManifestSet } from "@web4kit/manifest";
import { contentHash, type Export, itemsFile, manifestsFile, manifestsFromJson } from "./export";
import { type DatasetMeta, fromJsonl, gunzip, gzip, type Item } from "./format";

export const DEFAULT_DATA_DIR = resolve(import.meta.dirname, "../data/v1");

export function writeDataset(dir: string, { files, meta }: Export): void {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) rmSync(resolve(dir, name));
  for (const [name, text] of Object.entries(files))
    writeFileSync(resolve(dir, `${name}.gz`), gzip(text));
  writeFileSync(resolve(dir, "dataset.json"), `${JSON.stringify(meta, null, 2)}\n`);
}

/** The uncompressed data files of a dataset directory. */
export function readDataFiles(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir)
      .filter((n) => n.endsWith(".gz"))
      .sort()
      .map((n) => [n.slice(0, -3), gunzip(readFileSync(resolve(dir, n)))]),
  );
}

export interface Dataset {
  meta: DatasetMeta;
  sites: Record<string, { items: Item[]; manifests: ManifestSet }>;
}

export function loadDataset(dir: string = DEFAULT_DATA_DIR): Dataset {
  const meta = JSON.parse(readFileSync(resolve(dir, "dataset.json"), "utf8")) as DatasetMeta;
  const files = readDataFiles(dir);
  const hash = contentHash(files);
  if (hash !== meta.contentHash)
    throw new Error(`dataset ${dir}: content hash ${hash} does not match dataset.json`);
  const sites: Dataset["sites"] = {};
  for (const site of Object.keys(meta.sites)) {
    const items = files[itemsFile(site)];
    const manifests = files[manifestsFile(site)];
    if (!items || !manifests) throw new Error(`dataset ${dir}: files for ${site} missing`);
    sites[site] = {
      items: fromJsonl<Item>(items),
      manifests: manifestsFromJson(JSON.parse(manifests)),
    };
  }
  return { meta, sites };
}
