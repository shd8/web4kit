import { calibrationReport } from "@web4kit/next";
import { site } from "@/web4/site";

export const dynamic = "force-dynamic";

export default function Stats() {
  const s = site.stats();
  const hitRate = s.pages ? s.cacheHits / s.pages : 0;
  const report = calibrationReport(site);
  const calibration =
    s.calibration.status === "active"
      ? s.calibration.version
      : report.status === "rules"
        ? "rules"
        : report.status === "partial"
          ? `partial, stale for ${report.staleSources.join(", ")}: run ${report.fix}`
          : s.calibration.status === "stale"
            ? `stale (${s.calibration.reason}): run ${report.fix}`
            : "missing: every answer falls back to rules";
  const rows: Array<[string, string]> = [
    ["Engine", s.engineId],
    ["Calibration", calibration],
    ["Pages served", s.pages.toLocaleString("en")],
    ["Plan cache hit rate", `${(hitRate * 100).toFixed(1)}%`],
    ["Distinct situations", s.distinctSituations.toLocaleString("en")],
    ["Decider requests", s.deciderRequests.toLocaleString("en")],
    ["Input tokens", s.inputTokens.toLocaleString("en")],
    ["Decider cost", `$${s.costUsd.toFixed(5)}`],
    ["Cost per page (average)", `$${(s.pages ? s.costUsd / s.pages : 0).toFixed(6)}`],
    ["Average planning time", `${s.pages ? Math.round(s.planningMsTotal / s.pages) : 0} ms`],
    ["Since", s.since],
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-semibold">Planner stats</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Totals for this server process. Plans are shared by every visitor in the same situation.
      </p>
      <dl className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <a href="/" className="mt-6 inline-block text-sm underline">
        Back to the site
      </a>
    </main>
  );
}
