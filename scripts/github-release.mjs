// Create the GitHub release for a version that is live on npm (spec: public-release).
// The packages share one version, so there is one release, `v<version>`, tagged at the commit
// npm's provenance says the packages were built from. Its notes merge the package changelogs
// and link every package on npm.
//
//   node scripts/github-release.mjs 0.2.0            create the tag and release
//   node scripts/github-release.mjs 0.2.0 --dry-run  print the commit and notes
//
// Needs the GitHub CLI (`gh`), authenticated with permission to create releases.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const version = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: node scripts/github-release.mjs <version> [--dry-run]");
  process.exit(1);
}
const tag = `v${version}`;

try {
  execFileSync("gh", ["release", "view", tag], { stdio: "pipe" });
  console.log(`${tag} is already released.`);
  process.exit(0);
} catch {
  // Not released yet.
}

const packages = readdirSync(join(root, "packages")).flatMap((dir) => {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8"));
    return pkg.private ? [] : [{ dir: join(root, "packages", dir), name: pkg.name }];
  } catch {
    return [];
  }
});

const npmVersion = (name) => {
  try {
    return execFileSync("npm", ["view", `${name}@${version}`, "version"], { stdio: "pipe" })
      .toString()
      .trim();
  } catch {
    return "";
  }
};
const missing = packages.filter((p) => npmVersion(p.name) !== version);
if (missing.length) {
  console.error(`Not live on npm yet: ${missing.map((p) => p.name).join(", ")}`);
  process.exit(1);
}

/** The commit the provenance attestation of a package version names, if it has one. */
async function provenanceCommit(name) {
  const url = `https://registry.npmjs.org/-/npm/v1/attestations/${encodeURIComponent(name)}@${version}`;
  const response = await fetch(url);
  if (!response.ok) return undefined;
  const { attestations } = await response.json();
  for (const a of attestations ?? []) {
    if (!a.predicateType?.includes("slsa.dev/provenance")) continue;
    const payload = JSON.parse(Buffer.from(a.bundle.dsseEnvelope.payload, "base64").toString());
    const commit = payload.predicate?.buildDefinition?.resolvedDependencies?.[0]?.digest?.gitCommit;
    if (commit) return commit;
  }
  return undefined;
}

const commits = new Set(
  (await Promise.all(packages.map((p) => provenanceCommit(p.name)))).filter(Boolean),
);
if (commits.size !== 1) {
  console.error(
    commits.size
      ? `Packages were built from different commits: ${[...commits].join(", ")}`
      : "No provenance attestation names a commit; tag by hand.",
  );
  process.exit(1);
}
const [commit] = commits;

/** The changelog entries of one version, by heading ("Minor Changes", ...), without duplicates. */
const sections = new Map();
for (const p of packages) {
  let changelog;
  try {
    changelog = readFileSync(join(p.dir, "CHANGELOG.md"), "utf8");
  } catch {
    continue;
  }
  const start = changelog.indexOf(`\n## ${version}\n`);
  if (start < 0) continue;
  const end = changelog.indexOf("\n## ", start + 1);
  const body = changelog.slice(start, end < 0 ? undefined : end);
  for (const part of body.split("\n### ").slice(1)) {
    const [heading, ...lines] = part.split("\n");
    // Dependency bumps between packages released together say nothing to readers.
    if (heading === "Patch Changes" && lines.every((l) => !/^- [0-9a-f]{7}:/.test(l))) continue;
    const entries = sections.get(heading) ?? new Map();
    // Each entry starts with "- <changeset commit>: " and runs until the next one.
    for (const entry of lines.join("\n").split(/\n(?=- )/)) {
      const id = entry.match(/^- ([0-9a-f]{7}):/)?.[1];
      if (id && !entries.has(id)) entries.set(id, entry.trim());
    }
    sections.set(heading, entries);
  }
}

const notes = [
  ...[...sections].flatMap(([heading, entries]) =>
    entries.size ? [`## ${heading}`, "", ...entries.values(), ""] : [],
  ),
  "## Packages",
  "",
  ...packages.map(
    (p) => `- [\`${p.name}@${version}\`](https://www.npmjs.com/package/${p.name}/v/${version})`,
  ),
  "",
].join("\n");

console.log(`${tag} at ${commit}\n\n${notes}`);
if (dryRun) process.exit(0);

execFileSync(
  "gh",
  ["release", "create", tag, "--target", commit, "--title", tag, "--notes-file", "-", "--latest"],
  { input: notes, stdio: ["pipe", "inherit", "inherit"] },
);
