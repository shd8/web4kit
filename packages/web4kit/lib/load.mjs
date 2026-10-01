// Evaluate a site's TypeScript module the way the Next server would (react-server condition, so
// `server-only` imports work) and return what the loader extracted from it, as JSON.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MARKER = "\u0000web4kit:";
const loader = fileURLToPath(new URL("./loader.mjs", import.meta.url));

/** @param {"site" | "components"} mode */
export function loadFromSite(mode, modulePath, cwd = process.cwd()) {
  const file = resolve(cwd, modulePath);
  if (!existsSync(file)) throw new Error(`${modulePath} not found in ${cwd}`);
  const tsx = import.meta.resolve("tsx");
  const run = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", tsx, loader, mode, file],
    { cwd, encoding: "utf8", env: process.env, maxBuffer: 16 * 1024 * 1024 },
  );
  const line = run.stdout?.split("\n").find((l) => l.startsWith(MARKER));
  if (!line) {
    const detail = (run.stderr || run.stdout || "").trim().split("\n").slice(-8).join("\n");
    throw new Error(`could not load ${modulePath}:\n${detail}`);
  }
  const result = JSON.parse(line.slice(MARKER.length));
  if (result.error) throw new Error(result.error);
  return result;
}
