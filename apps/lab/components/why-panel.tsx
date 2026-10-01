"use client";

import { type Plan, REGIONS, type Why } from "@web4kit/ir";
import type { RenderedBlock } from "@web4kit/react";
import { DECIDED_BY, formatAnswer, whyDetails, whyLabel } from "@web4kit/react/why";
import type { PlanResponse } from "@/lib/examples";
import { Chip, cx } from "./ui";

function WhyChip({ why }: { why: Why }) {
  return (
    <span className="group relative inline-flex" title={whyDetails(why).join("\n")}>
      <Chip tone={DECIDED_BY[why.decidedBy].tone}>
        <span className="opacity-60">{whyLabel(why)}</span> {formatAnswer(why)}
        {why.confidence !== undefined && (
          <span className="opacity-60">·{why.confidence.toFixed(2)}</span>
        )}
      </Chip>
    </span>
  );
}

export function WhyPanel({
  response,
  rendered,
  cacheLabel,
}: {
  response: PlanResponse;
  rendered: RenderedBlock[];
  cacheLabel: string;
}) {
  const { plan } = response;
  const fallbackOf = new Map(rendered.map((r) => [r.sourceId, r]));
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-zinc-200 px-4 py-3 text-xs dark:border-zinc-800">
        <Stat label="engine" value={response.engineId} />
        <Stat label="calibration" value={response.calibration} />
        <Stat
          label="plan cache"
          value={cacheLabel}
          tone={cacheLabel.startsWith("hit") ? "green" : "zinc"}
        />
        <Stat label="planning" value={`${Math.round(response.planningMs)} ms`} />
        <Stat
          label="decider calls"
          value={`${response.usage.requests} · ${response.usage.inputTokens.toLocaleString("en")} tok`}
        />
        <Stat label="situation" value={plan.situationHash} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(["engine", "rule", "default", "invariant", "ungated"] as const).map((d) => (
            <Chip key={d} tone={DECIDED_BY[d].tone}>
              {DECIDED_BY[d].label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <span className="mr-1 font-code text-[0.68rem] uppercase tracking-wider text-zinc-500">
          decider sees
        </span>
        {Object.entries(response.situation).map(([k, v]) => (
          <Chip key={k}>
            {k}=<b className="font-semibold">{v}</b>
          </Chip>
        ))}
      </div>
      <table className="w-full text-left">
        <thead className="font-code text-[0.68rem] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">region</th>
            <th className="px-2 py-2 font-medium">source → component</th>
            <th className="px-2 py-2 font-medium">decisions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {REGIONS.flatMap((region) =>
            plan.layout[region].map((b) => {
              const r = fallbackOf.get(b.sourceId);
              return (
                <tr key={b.sourceId} className="align-top">
                  <td className="px-4 py-2.5 font-code text-xs text-zinc-500">{region}</td>
                  <td className="px-2 py-2.5 text-xs">
                    <div className="font-medium">{b.sourceId}</div>
                    <div className="font-code text-zinc-500">
                      {r?.componentId && r.componentId !== b.componentId ? (
                        <>
                          <s>{b.componentId}</s> → {r.componentId}
                        </>
                      ) : r && !r.componentId ? (
                        <span className="text-rose-600">omitted: {r.fallback}</span>
                      ) : (
                        b.componentId
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {b.why.map((w, i) => (
                        <WhyChip key={`${w.question}-${i}`} why={w} />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            }),
          )}
          {plan.excluded.map((e) => (
            <tr key={e.sourceId} className="align-top opacity-70">
              <td className="px-4 py-2.5 font-code text-xs text-zinc-500">excluded</td>
              <td className="px-2 py-2.5 text-xs font-medium line-through decoration-zinc-400">
                {e.sourceId}
              </td>
              <td className="px-2 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {e.why.slice(0, 3).map((w, i) => (
                    <WhyChip key={`${w.question}-${i}`} why={w} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: string;
  tone?: "zinc" | "green";
}) {
  return (
    <div className="min-w-0">
      <div className="font-code text-[0.62rem] uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={cx(
          "max-w-56 truncate font-code",
          tone === "green" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export type { Plan };
