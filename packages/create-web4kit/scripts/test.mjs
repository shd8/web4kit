// Offline test: scaffold into a temp dir and check the result.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
execFileSync("node", [join(here, "scripts/copy-template.mjs")], { stdio: "ignore" });
const dir = mkdtempSync(join(tmpdir(), "create-web4kit-"));
const target = join(dir, "My Hotel");
try {
  execFileSync("node", [join(here, "index.mjs"), target], { stdio: "ignore" });
  const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
  const version = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;
  const checks = {
    renamed: pkg.name === "my-hotel",
    noWorkspaceRanges: !JSON.stringify(pkg).includes("workspace:"),
    pinnedToScaffolderVersion: pkg.dependencies["@web4kit/planner"] === `^${version}`,
    gitignore: existsSync(join(target, ".gitignore")) && !existsSync(join(target, "_gitignore")),
    envExample: existsSync(join(target, ".env.example")),
    noSecrets: !existsSync(join(target, ".env")),
    noBuildOutput: !existsSync(join(target, ".next")) && !existsSync(join(target, "node_modules")),
    calibration: existsSync(join(target, "calibration/jev-1.13.0.json")),
    nextAdapter: pkg.dependencies["@web4kit/next"] === `^${version}`,
    tailwindIntegration: readFileSync(join(target, "app/globals.css"), "utf8").includes(
      "@web4kit/react/tailwind.css",
    ),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length) {
    console.error("✖ create-web4kit:", failed.map(([k]) => k).join(", "));
    process.exit(1);
  }
  console.log(`✓ create-web4kit: ${Object.keys(checks).length} checks passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
