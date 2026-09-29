import type { EngineRun } from "./runner";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const bar = (h: number[]) => {
  const max = Math.max(1, ...h);
  return h.map((v) => " ▁▂▃▄▅▆▇█"[Math.round((v / max) * 8)]).join("");
};

/** Markdown comparison report across engines (spec: conformance-suite). */
export function renderReport(site: string, runs: EngineRun[]): string {
  const lines: string[] = [`# web4 conformance: ${site}`, ""];
  lines.push(
    "| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of runs) {
    if (r.skipped) {
      lines.push(`| ${r.engine} | skipped: ${r.skipped} | | | | | | | | |`);
      continue;
    }
    lines.push(
      `| ${r.engineVersion} | ${r.fixtures} | ${r.labelled} | ${r.engineFailures} | ${r.repeats} | ${pct(r.invariantPassRate)} | ${Math.round(r.latencyMs.p50)} ms | ${Math.round(r.latencyMs.p95)} ms | ${Math.round(r.inputTokensPerPlan)} | $${r.costPerPlanUsd.toFixed(5)} |`,
    );
  }
  for (const r of runs.filter((x) => !x.skipped)) {
    lines.push("", `## ${r.engineVersion}`, "");
    lines.push(
      "| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |",
    );
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (const k of Object.values(r.byKind).sort((a, b) => a.kind.localeCompare(b.kind))) {
      lines.push(
        `| ${k.kind} | ${k.language} | ${k.samples} | ${pct(k.accuracy)} | ${k.meanConfidenceCorrect.toFixed(2)} | ${k.meanConfidenceIncorrect.toFixed(2)} | \`${bar(k.histogram.correct)}\` / \`${bar(k.histogram.incorrect)}\` | ${k.flipRate === undefined ? "–" : pct(k.flipRate)} | ${r.engine === "rules" ? "n/a (rules)" : k.uncalibrated ? "**uncalibrated**" : (k.threshold?.toFixed(3) ?? "–")} |`,
      );
    }
    if (r.invariantFailures.length) {
      lines.push("", "Invariant failures:", "");
      for (const f of r.invariantFailures.slice(0, 25))
        lines.push(`- \`${f.fixture}\`: ${f.detail}`);
      if (r.invariantFailures.length > 25)
        lines.push(`- … ${r.invariantFailures.length - 25} more`);
    }
  }
  return `${lines.join("\n")}\n`;
}
