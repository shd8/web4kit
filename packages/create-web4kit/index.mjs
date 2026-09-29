#!/usr/bin/env node
// create-web4kit: scaffold a web4 site from the Casa Ribeira starter.
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

const self = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "Usage: npm create web4kit@latest [directory]\n\nScaffolds a web4 site (Next.js) planned per visitor by System One models.",
  );
  process.exit(0);
}

const target = resolve(args.find((a) => !a.startsWith("-")) ?? "my-web4-site");
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`✖ ${target} is not empty`);
  process.exit(1);
}

const template = new URL("./template", import.meta.url).pathname;
if (!existsSync(template)) {
  console.error("✖ template missing: run `pnpm build` in packages/create-web4kit first");
  process.exit(1);
}
cpSync(template, target, { recursive: true });
if (existsSync(resolve(target, "_gitignore")))
  renameSync(resolve(target, "_gitignore"), resolve(target, ".gitignore"));

// Point workspace dependencies at the published @web4kit version this scaffolder belongs to.
const pkgPath = resolve(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = basename(target)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-");
for (const field of ["dependencies", "devDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (String(range).startsWith("workspace:")) pkg[field][name] = `^${self.version}`;
  }
}
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const rel = relative(process.cwd(), target) || ".";
console.log(`
✔ Created a web4 site in ${rel}

  cd ${rel}
  npm install
  cp .env.example .env     # optional: JEV_API_KEY to plan with Jev
  npm run dev              # http://localhost:3010

Preview personas with /?as=arriving-today, see /stats, and read README.md to make it yours.
`);
