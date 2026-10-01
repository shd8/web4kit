#!/usr/bin/env node
// create-web4kit: scaffold a web4 site (Next.js) planned per visitor by System One models.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyTemplate, DEFAULT_TEMPLATE, TEMPLATES } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const self = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : (args[i + 1] ?? "");
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: pnpm create web4kit [directory] [--template ${TEMPLATES.join("|")}]

Scaffolds a web4 site (Next.js) whose pages are planned per visitor by System One models.

  --template <name>  ${TEMPLATES.map((t) => (t === DEFAULT_TEMPLATE ? `${t} (default)` : t)).join(", ")}
  --laya             include in-process Laya (W4_ENGINE=laya: free, offline planning; ~300 MB)
  --registry         use published @web4kit packages even when run from a web4 checkout`);
  process.exit(0);
}

const templateName = flag("--template") ?? DEFAULT_TEMPLATE;
if (!TEMPLATES.includes(templateName)) {
  console.error(`✖ unknown template "${templateName}" (choose ${TEMPLATES.join(", ")})`);
  process.exit(1);
}
const valued = new Set(["--template"]);
const positional = args.filter((a, i) => !a.startsWith("-") && !valued.has(args[i - 1] ?? ""));
const target = resolve(positional[0] ?? "my-web4-site");
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`✖ ${target} is not empty`);
  process.exit(1);
}

// Run from a web4 checkout (packages not on npm yet): bundle the local packages as tarballs.
const repo = resolve(here, "../..");
const local = !args.includes("--registry") && existsSync(join(repo, "packages/ir/package.json"));
const template = local
  ? join(repo, "templates", templateName)
  : join(here, "template", templateName);
if (!existsSync(template)) {
  console.error(`✖ template missing: run \`pnpm build\` in packages/create-web4kit first`);
  process.exit(1);
}

console.log(`Creating a web4 site (${templateName}) in ${target}`);
copyTemplate(template, target, cpSync);
if (existsSync(join(target, "_gitignore")))
  renameSync(join(target, "_gitignore"), join(target, ".gitignore"));

const pkgPath = join(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name =
  basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-web4-site";

// Laya (ONNX Runtime) is heavy: keep it only when asked for.
if (!args.includes("--laya")) {
  delete pkg.optionalDependencies?.["@web4kit/decider-laya"];
  if (pkg.optionalDependencies && Object.keys(pkg.optionalDependencies).length === 0)
    delete pkg.optionalDependencies;
}
let versions = (_name) => `^${self.version}`;
if (local) versions = packLocal(repo, target, pkg);
for (const field of ["dependencies", "devDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (String(range).startsWith("workspace:")) pkg[field][name] = versions(name);
  }
}
for (const [name, range] of Object.entries(pkg.optionalDependencies ?? {})) {
  if (String(range).startsWith("workspace:")) pkg.optionalDependencies[name] = versions(name);
}
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const agent = process.env.npm_config_user_agent ?? "";
// pnpm is the default; follow npm or yarn when the scaffolder was started through them.
const pm = agent.startsWith("npm") ? "npm" : agent.startsWith("yarn") ? "yarn" : "pnpm";
const run = pm === "npm" ? "npm run" : pm;
const add = pm === "npm" ? "npm install" : `${pm} add`;
const port = templateName === "hotel" ? 3010 : 3000;
const rel = relative(process.cwd(), target) || ".";
console.log(`
✔ Created ${rel}${local ? " (with the local @web4kit packages from your web4 checkout)" : ""}

  cd ${rel}
  ${pm} install
  ${run} dev          # http://localhost:${port}

Next, pick the engine that plans pages. Until you do, the rules engine replays your
hand-written heuristics (a fallback, not web4 itself). In .env (cp .env.example .env):
  JEV_API_KEY=…      TypeSafe Jev, hosted${
    args.includes("--laya")
      ? "\n  W4_ENGINE=laya     Laya in this process: free and offline (~1.7 GB of weights on first run)"
      : `\n  W4_ENGINE=laya     Laya in this process: free and offline (${add} @web4kit/decider-laya first)`
  }
`);

/**
 * Pack every @web4kit library and the web4kit CLI into <target>/.web4kit and point the app
 * at the tarballs, including transitive @web4kit dependencies (overrides), so install works
 * without npm.
 */
function packLocal(repo, target, pkg) {
  const out = join(target, ".web4kit");
  mkdirSync(out, { recursive: true });
  const names = {};
  const libs = readdirSync(join(repo, "packages")).filter((d) => {
    const file = join(repo, "packages", d, "package.json");
    if (!existsSync(file)) return false;
    const p = JSON.parse(readFileSync(file, "utf8"));
    return p.name.startsWith("@web4kit/") || p.name === "web4kit";
  });
  for (const dir of libs) {
    process.stdout.write(`  packing ${dir}…\n`);
    const before = new Set(readdirSync(out));
    execFileSync("pnpm", ["pack", "--pack-destination", out], {
      cwd: join(repo, "packages", dir),
      stdio: "ignore",
    });
    const tgz = readdirSync(out).find((f) => !before.has(f));
    const name = JSON.parse(readFileSync(join(repo, "packages", dir, "package.json"), "utf8")).name;
    names[name] = `file:./.web4kit/${tgz}`;
  }
  pkg.overrides = { ...pkg.overrides, ...names };
  pkg.pnpm = { ...pkg.pnpm, overrides: { ...pkg.pnpm?.overrides, ...names } };
  pkg.resolutions = { ...pkg.resolutions, ...names };
  return (name) => names[name] ?? `^${self.version}`;
}
