import { basename } from "node:path";

export const TEMPLATES = ["welcome", "hotel"];
export const DEFAULT_TEMPLATE = "welcome";

const SKIP = new Set(["node_modules", ".next", ".env", "next-env.d.ts", "report.md", ".web4kit"]);

/** Copy a template directory, leaving out build output, secrets and local reports. */
export function copyTemplate(source, target, cpSync) {
  cpSync(source, target, {
    recursive: true,
    filter: (src) => !SKIP.has(basename(src)) && !src.endsWith(".tsbuildinfo"),
  });
}
