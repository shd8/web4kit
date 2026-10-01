"use client";

import type { Block, Plan, Why } from "@web4kit/ir";
import { REGIONS } from "@web4kit/ir";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import type { RenderedBlock } from "./render";
import { answerProbability, DECIDED_BY, formatAnswer, whyLabel } from "./why";

/** Calibration status as the planner reports it (structural, so react needs no planner). */
export interface XRayCalibration {
  status: string;
  staleSources?: string[];
  version?: string;
}

export interface XRayClientProps {
  plan: Plan;
  rendered?: RenderedBlock[];
  calibration?: XRayCalibration;
  engine?: string;
}

const STORAGE_KEY = "w4-xray";
const TONES: Record<string, string> = {
  green: "var(--w4-ok, #16a34a)",
  blue: "var(--w4-accent, #0284c7)",
  amber: "var(--w4-warn, #d97706)",
  orange: "var(--w4-primary, #ea580c)",
  red: "var(--w4-bad, #dc2626)",
};

const readStored = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Development X-ray (spec: dev-tooling). Hover a block (or tap it on a touch device) to see
 * every recorded decision. Drawn in a fixed layer above the page: block markup never changes.
 */
export function XRayClient({ plan, rendered = [], calibration, engine }: XRayClientProps) {
  const [on, setOn] = useState(false);
  /** The inspected block; `pinned` when opened by a tap (the card then takes pointer input). */
  const [active, setActive] = useState<{ id: string; rect: DOMRect; pinned: boolean } | null>(null);
  const blocks = new Map(REGIONS.flatMap((r) => plan.layout[r].map((b) => [b.sourceId, b])));

  useEffect(() => setOn(readStored()), []);
  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        // Storage may be blocked; the toggle still works for this page.
      }
      return !v;
    });
    setActive(null);
  }, []);

  useEffect(() => {
    if (!on) return;
    const root = document.querySelector(`[data-w4-plan="${CSS.escape(plan.situationHash)}"]`);
    if (!root) return;
    const blockAt = (target: EventTarget | null) => {
      const el = target instanceof Element ? target.closest("[data-w4-block]") : null;
      return el && root.contains(el) ? el : null;
    };
    const show = (el: Element | null, pinned = false) =>
      setActive(
        el
          ? { id: el.getAttribute("data-w4-block")!, rect: el.getBoundingClientRect(), pinned }
          : null,
      );
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if ((e.target as Element | null)?.closest?.("[data-w4-xray]")) return;
      show(blockAt(e.target));
    };
    // Taps inspect instead of activating links inside blocks; tapping elsewhere dismisses. The
    // pointer type is taken from pointerdown: synthesized clicks do not always report it.
    let lastPointer = "mouse";
    const onDown = (e: PointerEvent) => {
      lastPointer = e.pointerType || "mouse";
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-w4-xray]")) return;
      const el = blockAt(e.target);
      const touch = lastPointer !== "mouse";
      if (touch && el) e.preventDefault();
      if (touch || !el) show(el, touch);
    };
    const onScroll = () => setActive(null);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [on, plan.situationHash]);

  const block = active ? blocks.get(active.id) : undefined;
  return (
    <div data-w4-xray="" style={{ fontFamily: "var(--w4-font-mono, ui-monospace, monospace)" }}>
      {on && active && block && (
        <>
          <div
            aria-hidden
            style={{
              position: "fixed",
              pointerEvents: "none",
              top: active.rect.top,
              left: active.rect.left,
              width: active.rect.width,
              height: active.rect.height,
              outline: `2px dashed ${TONES.orange}`,
              borderRadius: 8,
              zIndex: 2147483000,
            }}
          />
          <BlockCard
            block={block}
            rendered={rendered.find((r) => r.sourceId === block.sourceId)}
            // A hover card is a tooltip: it must not catch the pointer on its way to the next block.
            style={{ ...cardPosition(active.rect), pointerEvents: active.pinned ? "auto" : "none" }}
          />
        </>
      )}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 2147483001,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          maxWidth: "min(24rem, calc(100vw - 24px))",
        }}
      >
        {on && <SummaryPanel plan={plan} calibration={calibration} engine={engine} />}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={on}
          className="rounded-full border border-border bg-foreground px-3 py-1.5 text-xs text-background shadow-lg"
        >
          X-ray {on ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}

function cardPosition(rect: DOMRect): CSSProperties {
  const width = Math.min(400, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const below = rect.bottom + 8;
  const room = window.innerHeight - below;
  return {
    position: "fixed",
    left,
    width,
    zIndex: 2147483001,
    maxHeight: "60vh",
    overflowY: "auto",
    ...(room > 240 || rect.top < 240
      ? { top: Math.min(below, window.innerHeight - 240) }
      : { bottom: window.innerHeight - rect.top + 8 }),
  };
}

/** Every decision recorded for one block. */
export function BlockCard({
  block,
  rendered,
  style,
}: {
  block: Block;
  rendered?: RenderedBlock | undefined;
  style?: CSSProperties;
}) {
  const fallback = rendered && rendered.componentId !== block.componentId;
  return (
    <div
      data-w4-xray-card={block.sourceId}
      style={style}
      className="rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <strong className="text-sm">{block.sourceId}</strong>
        <span className="text-muted-foreground">
          {fallback ? (
            <>
              <s>{block.componentId}</s> → {rendered.componentId ?? "omitted"}
            </>
          ) : (
            block.componentId
          )}
        </span>
      </div>
      {engines(block.why).length > 0 && (
        <p className="mb-2 text-muted-foreground">answered by {engines(block.why).join(", ")}</p>
      )}
      {block.why.some((w) => w.decidedBy === "ungated") && (
        <p className="mb-2" style={{ color: TONES.red }}>
          ungated in dev: no current calibration, so production uses rules here
        </p>
      )}
      {fallback && rendered.fallback && (
        <p className="mb-2 text-muted-foreground">rendered fallback: {rendered.fallback}</p>
      )}
      <WhyTable why={block.why} />
    </div>
  );
}

/** Engine versions that answered (or were overridden) in these records. */
const engines = (why: Why[]) => [...new Set(why.flatMap((w) => (w.engine ? [w.engine] : [])))];

function WhyTable({ why }: { why: Why[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pr-2 font-normal">question</th>
            <th className="pr-2 font-normal">answer</th>
            <th className="pr-2 font-normal">p</th>
            <th className="pr-2 font-normal">conf</th>
            <th className="pr-2 font-normal">thr</th>
            <th className="whitespace-nowrap font-normal">decided by</th>
          </tr>
        </thead>
        <tbody>
          {why.map((w, i) => {
            const p = answerProbability(w);
            const by = DECIDED_BY[w.decidedBy];
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: a plan's records are a fixed list; the same question can repeat
              <tr key={`${w.question}-${i}`} data-w4-why={w.question} title={w.note}>
                <td className="pr-2">{whyLabel(w)}</td>
                <td className="pr-2">{formatAnswer(w)}</td>
                <td className="pr-2">{p !== undefined ? p.toFixed(2) : "–"}</td>
                <td className="pr-2">
                  {w.confidence !== undefined ? w.confidence.toFixed(2) : "–"}
                </td>
                <td className="pr-2">
                  {w.threshold !== undefined && w.threshold !== null
                    ? w.threshold.toFixed(2)
                    : "none"}
                </td>
                <td className="whitespace-nowrap" title={w.engine}>
                  <span
                    data-w4-decided-by={w.decidedBy}
                    style={{
                      color: TONES[by.tone],
                      fontWeight: w.decidedBy === "ungated" ? 700 : 400,
                    }}
                  >
                    {w.decidedBy === "ungated" ? "ungated" : by.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Calibration status and every excluded source with the records that excluded it. */
export function SummaryPanel({
  plan,
  calibration,
  engine,
}: {
  plan: Plan;
  calibration?: XRayCalibration | undefined;
  engine?: string | undefined;
}) {
  const stale = calibration?.staleSources ?? [];
  // Collapsed to one line by default so it never hides the blocks being inspected (phones).
  return (
    <details
      data-w4-xray-summary=""
      className="max-h-[50vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-3 text-xs text-card-foreground shadow-xl"
    >
      <summary className="cursor-pointer">
        <span className="text-muted-foreground">engine</span> {engine ?? plan.engine}
        {calibration && (
          <>
            {" · "}
            <span className="text-muted-foreground">calibration</span> {calibration.status}
          </>
        )}
        {stale.length > 0 && <span style={{ color: TONES.red }}> (stale: {stale.join(", ")})</span>}
        {" · "}
        <span className="text-muted-foreground">excluded</span> {plan.excluded.length}
      </summary>
      {stale.length > 0 && (
        <p data-w4-stale-sources="" style={{ color: TONES.red }}>
          stale: {stale.join(", ")} (ungated in dev; run pnpm calibrate)
        </p>
      )}
      <p className="mt-2 text-muted-foreground">
        {plan.excluded.length === 0 ? "nothing excluded" : "excluded sources"}
      </p>
      {plan.excluded.map((e) => (
        <div key={e.sourceId} data-w4-excluded={e.sourceId} className="mt-2">
          <s>{e.sourceId}</s>
          <WhyTable why={e.why} />
        </div>
      ))}
    </details>
  );
}
