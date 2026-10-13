// Generate the standalone starter (github.com/shd8/web4kit-starter) from a version live on npm.
// It is exactly what `create-web4kit@<version>` scaffolds, plus an npm lockfile, so Vercel and
// StackBlitz can install it as cloned. The README's Try it buttons point at that repository.
//
//   node scripts/starter.mjs 0.2.0 <dir>    write the starter into <dir> (kept: <dir>/.git)
//
// Run from the smoke workflow after a release is approved; never edit the starter by hand.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [version, dir] = process.argv.slice(2);
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version) || !dir) {
  console.error("usage: node scripts/starter.mjs <version> <dir>");
  process.exit(1);
}
const target = resolve(dir);
const scratch = mkdtempSync(join(tmpdir(), "web4kit-starter-"));
const site = join(scratch, "web4kit-starter");
// npm's user agent makes the scaffolder print npm commands.
const env = { ...process.env, npm_config_user_agent: "npm" };
execFileSync("npx", ["-y", `create-web4kit@${version}`, site, "--registry"], {
  stdio: "inherit",
  env,
});

const pkg = JSON.parse(readFileSync(join(site, "package.json"), "utf8"));
if (JSON.stringify(pkg).includes("workspace:"))
  throw new Error("starter still has workspace: ranges");
execFileSync("npm", ["install", "--package-lock-only", "--no-audit", "--no-fund"], {
  cwd: site,
  stdio: "inherit",
});

const readme = join(site, "README.md");
writeFileSync(
  readme,
  `> Generated from [web4kit](https://github.com/shd8/web4kit) ${version} by \`create-web4kit\`. To change it, edit \`templates/welcome\` there; this repository is regenerated on every release.\n\n${readFileSync(readme, "utf8")}`,
);

// Replace everything but the repository's own .git.
if (existsSync(target))
  for (const f of readdirSync(target))
    if (f !== ".git") rmSync(join(target, f), { recursive: true, force: true });
cpSync(site, target, { recursive: true });
rmSync(scratch, { recursive: true, force: true });
console.log(`starter for web4kit ${version} written to ${target}`);
