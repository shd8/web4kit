import type { Plan, Why } from "@web4kit/ir";
import type { ManifestSet } from "@web4kit/manifest";
import { defaultRegistry, type PlanData, PlanView } from "@web4kit/react";
import { DECIDED_BY, formatAnswer, whyLabel } from "@web4kit/react/why";

/**
 * What an embed shows for one situation: its labels, the planned page with one block
 * highlighted, and that block's recorded decisions. Pure, so it is rendered and tested
 * without a browser.
 */
export function EmbedView({
  scope,
  plan,
  data,
  manifests,
  theme,
  focus,
  situation,
  showWhy = false,
}: {
  /** Unique per embed on the page: two embeds can show the same plan. */
  scope: string;
  plan: Plan;
  data: PlanData;
  manifests: ManifestSet;
  theme: string;
  focus?: string | undefined;
  situation?: Record<string, string> | undefined;
  showWhy?: boolean;
}) {
  const block = focus
    ? Object.values(plan.layout)
        .flat()
        .find((b) => b.sourceId === focus)
    : undefined;
  const excluded = focus ? plan.excluded.find((e) => e.sourceId === focus) : undefined;
  return (
    <div
      className="flex flex-col gap-3"
      data-embed-scope={scope}
      data-embed-plan={plan.situationHash}
    >
      {situation && (
        <ul aria-label="Situation labels" className="flex flex-wrap gap-1.5 text-xs">
          {Object.entries(situation).map(([k, v]) => (
            <li key={k} className="rounded-md bg-fd-muted px-2 py-0.5 font-mono">
              {k}: <b>{v}</b>
            </li>
          ))}
        </ul>
      )}
      {focus && (
        <p className="text-sm" data-embed-focus-state={block ? "shown" : "absent"}>
          <code>{focus}</code>{" "}
          {block ? "is on this page" : excluded ? "is not on this page" : "is not planned"}
        </p>
      )}
      <div
        data-w4-theme={theme}
        className="max-h-[560px] overflow-hidden rounded-xl bg-background p-3 text-foreground"
      >
        {focus && (
          <style>{`[data-embed-scope="${scope}"] [data-w4-block="${focus}"]{outline:3px solid var(--w4-primary);outline-offset:3px;border-radius:var(--w4-radius)}`}</style>
        )}
        <PlanView plan={plan} data={data} manifests={manifests} registry={defaultRegistry} />
      </div>
      {showWhy && (block || excluded) && <WhyList why={(block ?? excluded)!.why} />}
    </div>
  );
}

function WhyList({ why }: { why: Why[] }) {
  return (
    <table className="w-full text-left text-xs" data-embed-why="">
      <thead className="text-fd-muted-foreground">
        <tr>
          <th className="font-normal">question</th>
          <th className="font-normal">answer</th>
          <th className="font-normal">confidence</th>
          <th className="font-normal">threshold</th>
          <th className="font-normal">decided by</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {why.map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a plan's records are a fixed list
          <tr key={`${w.question}-${i}`}>
            <td>{whyLabel(w)}</td>
            <td>{formatAnswer(w)}</td>
            <td>{w.confidence?.toFixed(2) ?? "–"}</td>
            <td>{w.threshold == null ? "none" : w.threshold.toFixed(2)}</td>
            <td>
              {DECIDED_BY[w.decidedBy].label}
              {w.engine ? ` · ${w.engine}` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
