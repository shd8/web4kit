// Public-name check (spec: public-release): no tracked file may point at the old repository URL
// or at a placeholder domain. Lockfiles and changelogs are historical and skipped.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PATTERNS = [
  { re: /github\.com\/shd8\/web4(?!kit)/, why: "old repository URL (use github.com/shd8/web4kit)" },
  { re: /web4kit\.dev/, why: "placeholder domain (use https://shd8.github.io/web4kit/)" },
];
const SKIP = /(^|\/)(pnpm-lock\.yaml|CHANGELOG\.md)$|^scripts\/check-urls\.mjs$/;

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && !SKIP.test(f));
const hits = [];
for (const file of files) {
  if (!existsSync(file)) continue; // deleted in the working tree
  const text = readFileSync(file, "utf8");
  if (text.includes("\0")) continue; // binary
  text.split("\n").forEach((line, i) => {
    for (const { re, why } of PATTERNS)
      if (re.test(line)) hits.push(`${file}:${i + 1}: ${why}\n    ${line.trim()}`);
  });
}
if (hits.length) {
  console.error(`✗ ${hits.length} stale URL(s):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`✓ no stale URLs in ${files.length} tracked files`);
