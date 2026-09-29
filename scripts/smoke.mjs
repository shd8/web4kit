// Publishability smoke test: pack every library package exactly as `npm publish` would, install
// the tarballs into a clean project outside the workspace, type-check it with TypeScript 5.9
// and run it with plain Node. Fails if exports, types or dependencies are broken.
import { execSync, spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  "create-web4kit",
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
  const scaffolder = tarballs["@web4kit/create-web4kit"];
  delete tarballs["@web4kit/create-web4kit"];
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
  console.log("\n✓ library smoke passed: packed packages install, type-check (TS 5.9) and run");

  // Starter: scaffold from the packed create-web4kit, install the tarballs, build and serve.
  if (!process.argv.includes("--no-starter")) {
    const tool = join(work, "tool");
    mkdirSync(tool);
    run(`tar -xzf ${scaffolder.replace("file:", "")} -C ${tool}`, work);
    const site = join(work, "site");
    run(`node ${join(tool, "package/index.mjs")} ${site}`, work);
    const sitePkgPath = join(site, "package.json");
    const sitePkg = JSON.parse(readFileSync(sitePkgPath, "utf8"));
    sitePkg.overrides = tarballs;
    for (const field of ["dependencies", "devDependencies"]) {
      for (const name of Object.keys(sitePkg[field] ?? {}))
        if (tarballs[name]) sitePkg[field][name] = tarballs[name];
    }
    writeFileSync(sitePkgPath, JSON.stringify(sitePkg, null, 2));
    run("npm install --no-audit --no-fund --loglevel=error", site);
    run("npx tsc --noEmit -p tsconfig.json", site);
    run("npx vitest run", site);
    run("npx next build", site);
    const server = spawn("npx", ["next", "start", "--port", "3099"], {
      cwd: site,
      stdio: "ignore",
      env: { ...process.env, JEV_API_KEY: "" },
    });
    try {
      let html = "";
      for (let i = 0; i < 60 && !html; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        html = await fetch("http://localhost:3099/?src=instagram&as=arriving-today").then(
          (r) => (r.ok ? r.text() : ""),
          () => "",
        );
      }
      const blocks = [...html.matchAll(/data-w4-block="([a-z-]+)"/g)].map((m) => m[1]);
      if (!blocks.includes("hero-photos") || !blocks.includes("rooms"))
        throw new Error(`starter page missing blocks: ${blocks.join(", ")}`);
      if (blocks.includes("arrival-guide"))
        throw new Error("production must ignore ?as= persona previews");
      if (html.includes("Preview as"))
        throw new Error("production must not render the dev persona bar");
      console.log(`\n✓ starter smoke passed: scaffolded, built and served (${blocks.join(", ")})`);
    } finally {
      server.kill();
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
