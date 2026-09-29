// Copies templates/next-starter into ./template so the published package is self-contained.
import { cpSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const source = resolve(here, "../../templates/next-starter");
const target = resolve(here, "template");
const SKIP = new Set([
  "node_modules",
  ".next",
  ".env",
  "next-env.d.ts",
  "report.md",
  "per-source.tmp.ts",
]);

rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
  recursive: true,
  filter: (src) => !SKIP.has(basename(src)) && !src.endsWith(".tsbuildinfo"),
});
console.log(`template copied to ${target}`);
