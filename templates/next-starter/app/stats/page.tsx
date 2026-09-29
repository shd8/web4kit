import Link from "next/link";
import { stats } from "@/web4/server";

export const dynamic = "force-dynamic";

export default function Stats() {
  const hitRate = stats.pages ? stats.cacheHits / stats.pages : 0;
  const cost = (stats.inputTokens / 1e6) * stats.costPerMTok;
  const rows: Array<[string, string]> = [
    ["Engine", stats.engine],
    ["Calibration", stats.calibration],
    ["Pages served", stats.pages.toLocaleString("en")],
    ["Plan cache hit rate", `${(hitRate * 100).toFixed(1)}%`],
    ["Distinct situations", stats.situations.size.toLocaleString("en")],
    ["Decider requests", stats.deciderRequests.toLocaleString("en")],
    ["Input tokens", stats.inputTokens.toLocaleString("en")],
    ["Decider cost", `$${cost.toFixed(5)}`],
    ["Cost per page (average)", `$${(stats.pages ? cost / stats.pages : 0).toFixed(6)}`],
    [
      "Average planning time",
      `${stats.pages ? Math.round(stats.planningMsTotal / stats.pages) : 0} ms`,
    ],
    ["Since", stats.startedAt],
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
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        Back to the site
      </Link>
    </main>
  );
}
