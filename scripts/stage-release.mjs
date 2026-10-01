// Stage every public package version that isn't on npm yet (spec: public-release).
// The npm token is stage-only: `npm stage publish` uploads each version with provenance, and a
// maintainer then approves it with 2FA (`npm stage approve`). Nothing is live until approved.
//
//   node scripts/stage-release.mjs            stage what's missing (CI, after Version Packages)
//   node scripts/stage-release.mjs --dry-run  say what would be staged
//
// Needs npm >= 12 (the `stage` command) and Node >= 22.22.
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const packages = readdirSync(join(root, "packages"))
  .map((dir) => ({
    dir: join(root, "packages", dir),
    file: join(root, "packages", dir, "package.json"),
  }))
  .flatMap(({ dir, file }) => {
    try {
      const pkg = JSON.parse(readFileSync(file, "utf8"));
      return pkg.private ? [] : [{ dir, name: pkg.name, version: pkg.version }];
    } catch {
      return [];
    }
  });

const onNpm = (spec) => {
  try {
    execFileSync("npm", ["view", spec, "version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};

const missing = packages.filter((p) => !onNpm(`${p.name}@${p.version}`));
if (!missing.length) {
  console.log(`Nothing to stage: all ${packages.length} public packages are on npm.`);
  process.exit(0);
}
console.log(
  `To stage (${missing.length}): ${missing.map((p) => `${p.name}@${p.version}`).join(", ")}`,
);
if (dryRun) process.exit(0);

// pnpm pack resolves workspace: ranges to real versions, as `pnpm publish` would.
const out = mkdtempSync(join(tmpdir(), "web4kit-stage-"));
const staged = [];
for (const p of missing) {
  execSync(`pnpm pack --pack-destination ${out}`, { cwd: p.dir, stdio: "inherit" });
  const tgz = join(out, `${p.name.replace(/^@/, "").replace("/", "-")}-${p.version}.tgz`);
  execFileSync("npm", ["stage", "publish", tgz, "--access", "public", "--provenance"], {
    stdio: "inherit",
  });
  staged.push(`${p.name}@${p.version}`);
}
console.log(
  `\n✓ staged ${staged.length}: ${staged.join(", ")}\nApprove each with 2FA: npm stage list, then npm stage approve <stage-id>.\nThen run the "Smoke test npm" workflow for this version.`,
);
