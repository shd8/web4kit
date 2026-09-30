// Offline test: scaffold each template (published-package mode) into a temp dir and check it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { TEMPLATES } from "../lib.mjs";

const here = resolve(import.meta.dirname, "..");
execFileSync("node", [join(here, "scripts/copy-template.mjs")], { stdio: "ignore" });
const version = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;
const dir = mkdtempSync(join(tmpdir(), "create-web4kit-"));
let failures = 0;
try {
  for (const template of TEMPLATES) {
    const target = join(dir, `My ${template} site`);
    execFileSync("node", [join(here, "index.mjs"), target, "--template", template, "--registry"], {
      stdio: "ignore",
    });
    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    const checks = {
      renamed: pkg.name === `my-${template}-site`,
      noWorkspaceRanges: !JSON.stringify(pkg).includes("workspace:"),
      pinnedToScaffolderVersion: pkg.dependencies["@web4kit/planner"] === `^${version}`,
      nextAdapter: pkg.dependencies["@web4kit/next"] === `^${version}`,
      gitignore: existsSync(join(target, ".gitignore")) && !existsSync(join(target, "_gitignore")),
      envExample: existsSync(join(target, ".env.example")),
      noSecrets: !existsSync(join(target, ".env")),
      noBuildOutput:
        !existsSync(join(target, ".next")) && !existsSync(join(target, "node_modules")),
      calibration: existsSync(join(target, "calibration/jev-1.13.0.json")),
      tailwindIntegration: readFileSync(join(target, "app/globals.css"), "utf8").includes(
        "@web4kit/react/tailwind.css",
      ),
    };
    const failed = Object.entries(checks).filter(([, ok]) => !ok);
    if (failed.length) {
      failures++;
      console.error(`✖ create-web4kit ${template}:`, failed.map(([k]) => k).join(", "));
    } else console.log(`✓ create-web4kit ${template}: ${Object.keys(checks).length} checks passed`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failures) process.exit(1);
