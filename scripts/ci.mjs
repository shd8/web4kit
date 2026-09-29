// CI: build, lint, tests and the conformance suite with the rules engine only.
// Runs with no engine credentials and no network access to engines (spec: conformance-suite).
import { execSync } from "node:child_process";

const env = { ...process.env, JEV_API_KEY: "", W4_LOCAL_ENGINE_URL: "", W4_LIVE: "" };
const steps = [
  ["build", "pnpm -r build"],
  ["lint", "pnpm exec biome check ."],
  ["test", "pnpm -r test"],
  [
    "conformance (rules)",
    "pnpm exec tsx scripts/conformance.ts --engines rules,jev,local --report-dir .w4-cache/reports",
  ],
];
for (const [name, cmd] of steps) {
  console.log(`\n▶ ${name}: ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
}
console.log("\n✓ ci passed");
