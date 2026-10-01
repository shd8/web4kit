import { loadFromSite } from "./load.mjs";

/**
 * `web4kit check`: print the site's calibration report (spec: dev-tooling). Never calls the
 * decider; it only compares the stored profile with the current manifests.
 * @returns exit code
 */
export async function check({ site = "web4/site.ts", strict = false, cwd = process.cwd() } = {}) {
  const { report } = loadFromSite("site", site, cwd);
  const symbol = report.ok ? "✓" : "⚠";
  console.log(`${symbol} ${report.message}`);
  if (report.ok) return 0;
  if (strict) {
    console.error(`✖ calibration is ${report.status} (--strict)`);
    return 1;
  }
  return 0;
}
