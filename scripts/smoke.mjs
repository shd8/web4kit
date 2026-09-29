// Publishability smoke test: pack every library package exactly as `npm publish` would, install
// the tarballs into a clean project outside the workspace, type-check it with TypeScript 5.9
// and run it with plain Node. Fails if exports, types or dependencies are broken.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const PACKAGES = [
  "ir",
  "decider",
  "context",
  "manifest",
  "planner",
  "solver",
  "react",
  "conformance",
  "decider-laya",
];
const work = mkdtempSync(join(tmpdir(), "web4kit-smoke-"));
const packDir = join(work, "pack");
const app = join(work, "app");
mkdirSync(packDir);
mkdirSync(app);
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

try {
  for (const p of PACKAGES)
    run(`pnpm pack --pack-destination ${packDir}`, join(root, "packages", p));
  const tarballs = Object.fromEntries(
    readdirSync(packDir).map((f) => [
      `@web4kit/${f.replace(/^web4kit-/, "").replace(/-\d+\.\d+\.\d+.*\.tgz$/, "")}`,
      `file:${join(packDir, f)}`,
    ]),
  );
  const { "@web4kit/decider-laya": _laya, ...deps } = tarballs; // decider-laya pulls onnxruntime; packed only
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      {
        name: "web4kit-smoke",
        private: true,
        type: "module",
        dependencies: { ...deps, react: "^19.3.0", "react-dom": "^19.3.0" },
        overrides: tarballs,
        devDependencies: {
          typescript: "~5.9.2",
          "@types/react": "^19.3.0",
          "@types/react-dom": "^19",
          "@types/node": "^22",
        },
      },
      null,
      2,
    ),
  );
  cpSync(join(root, "scripts/smoke/site.ts"), join(app, "site.ts"));
  cpSync(join(root, "scripts/smoke/tsconfig.json"), join(app, "tsconfig.json"));
  run("npm install --no-audit --no-fund --loglevel=error", app);
  run("npx tsc -p tsconfig.json", app);
  run("node site.ts", app);
  console.log("\n✓ smoke test passed: packed packages install, type-check (TS 5.9) and run");
} finally {
  rmSync(work, { recursive: true, force: true });
}
