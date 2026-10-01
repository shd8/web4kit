// Link check over the static export: every internal href/src resolves to a file in out/, and
// every link into this repository on GitHub (blob/tree on main) names a path that exists here.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(import.meta.dirname, "../out");
const base = process.env.SITE_BASE_PATH ?? "";
const pages = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".html")) pages.push(p);
  }
};
walk(out);

const repo = resolve(import.meta.dirname, "../../..");
const REPO_LINK = /href="https:\/\/github\.com\/shd8\/web4kit\/(?:blob|tree)\/main\/([^"#?]+)/g;

const broken = new Set();
let checked = 0;
let repoLinks = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    if (base && !url.startsWith(base)) {
      broken.add(`${url} (missing base path) in ${page.slice(out.length)}`);
      continue;
    }
    const path = url.slice(base.length) || "/";
    const file = join(out, path);
    checked++;
    if (!(existsSync(file) && statSync(file).isFile()) && !existsSync(join(file, "index.html")))
      broken.add(`${url} in ${page.slice(out.length)}`);
  }
}
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const [, path] of html.matchAll(REPO_LINK)) {
    repoLinks++;
    if (!existsSync(join(repo, decodeURIComponent(path))))
      broken.add(`github …/${path} (no such path in the repository) in ${page.slice(out.length)}`);
  }
}
if (broken.size) {
  console.error(`✖ ${broken.size} broken internal links:\n  ${[...broken].join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ ${checked} internal links in ${pages.length} pages resolve, and ${repoLinks} links into the repository exist`,
);
