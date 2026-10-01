"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManifestSet } from "@web4kit/manifest";
import { defaultRegistry, PlanView } from "@web4kit/react";
import { XRay } from "@web4kit/react/xray";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { TryIt } from "@/components/try-it";
import {
  type Control,
  defaultValues,
  SITES,
  type SiteId,
  type SiteMeta,
  siteQuery,
  THEMES,
  type Values,
  type View,
  valuesFromQuery,
  viewQuery,
} from "@/lib/playground/bundle";

const SITE_LABELS: Record<SiteId, string> = {
  restaurant: "Restaurant",
  hotel: "Hotel",
  welcome: "Welcome starter",
};
const DEVICE_WIDTH: Record<string, string> = {
  mobile: "max-w-[420px]",
  tablet: "max-w-[820px]",
  desktop: "max-w-none",
};

export function Playground() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <PlaygroundView />
    </QueryClientProvider>
  );
}

/** The selection is explicit once the viewer acts; before that it comes from the URL. */
type Selection = { site: SiteId; values: Values | null; query: URLSearchParams };

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function PlaygroundView() {
  const qc = useQueryClient();
  const [selection, setSelection] = useState<Selection | null>(null);

  // The URL is read once, on the client (the page itself is static).
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const site = query.get("site");
    setSelection({
      site: SITES.includes(site as SiteId) ? (site as SiteId) : "restaurant",
      values: null,
      query,
    });
  }, []);

  const site = selection?.site;
  const { data: bundle, error } = useQuery({
    ...siteQuery(site ?? "restaurant"),
    enabled: !!site,
  });
  const values =
    bundle && selection
      ? (selection.values ?? valuesFromQuery(bundle.index, selection.query))
      : undefined;
  const { data: view } = useQuery({
    ...viewQuery(qc, site ?? "restaurant", values ?? {}),
    enabled: !!values,
  });

  /** Load the next view first, then swap it in one synchronous update (animated if allowed). */
  async function go(nextSite: SiteId, nextValues?: Values) {
    const next = await qc.ensureQueryData(siteQuery(nextSite));
    const resolved = nextValues ?? defaultValues(next.index);
    await qc.ensureQueryData(viewQuery(qc, nextSite, resolved));
    window.history.replaceState(
      null,
      "",
      `?${new URLSearchParams({ site: nextSite, ...resolved })}`,
    );
    const apply = () =>
      flushSync(() =>
        setSelection({ site: nextSite, values: resolved, query: new URLSearchParams() }),
      );
    if (!reducedMotion() && document.startViewTransition) document.startViewTransition(apply);
    else apply();
  }

  if (error) return <p className="text-fd-error">Could not load the playground: {String(error)}</p>;
  if (!site || !bundle || !values) return <p className="text-fd-muted-foreground">Loading…</p>;
  const { index, manifests, meta } = bundle;

  return (
    <div className="flex flex-col gap-6" data-playground={site}>
      <nav aria-label="Demo site" className="flex flex-wrap gap-2">
        {SITES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === site}
            onClick={() => go(s)}
            className={pill(s === site)}
          >
            {SITE_LABELS[s]}
          </button>
        ))}
      </nav>

      <section
        aria-label="Visitor"
        className="flex flex-col gap-4 rounded-xl border border-fd-border p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
            Personas
          </span>
          {index.personas.map((p) => (
            <button
              key={p.name}
              type="button"
              data-persona={p.name}
              aria-pressed={index.controls.every((c) => values[c.id] === p.values[c.id])}
              onClick={() => go(site, p.values)}
              className={pill(index.controls.every((c) => values[c.id] === p.values[c.id]))}
            >
              {p.title}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {index.controls.map((control) => (
            <ControlInput
              key={control.id}
              control={control}
              value={values[control.id]!}
              onChange={(v) => go(site, { ...values, [control.id]: v })}
            />
          ))}
        </div>
      </section>

      {view && <Counters meta={meta} view={view} />}

      {view && (
        <ViewPreview
          site={site}
          view={view}
          manifests={manifests}
          meta={meta}
          device={values.device ?? "desktop"}
        />
      )}

      <TryIt />
    </div>
  );
}

function ControlInput({
  control,
  value,
  onChange,
}: {
  control: Control;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `control-${control.id}`;
  if (control.options.length > 8) {
    const i = control.options.findIndex((o) => o.value === value);
    return (
      <label htmlFor={id} className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          {control.label}:{" "}
          <output data-control-value={control.id}>{control.options[i]?.label}</output>
        </span>
        <input
          id={id}
          type="range"
          min={0}
          max={control.options.length - 1}
          value={i}
          data-control={control.id}
          onChange={(e) => onChange(control.options[Number(e.target.value)]!.value)}
        />
      </label>
    );
  }
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="mb-1 font-medium">{control.label}</legend>
      <div className="flex flex-wrap gap-1.5" data-control={control.id}>
        {control.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={pill(o.value === value, true)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Real cost and latency of this plan's original planning, and of the whole site (spec). */
function Counters({ meta, view }: { meta: SiteMeta; view: View }) {
  const u = view.usage;
  const items: Array<[string, string]> = [
    ["Planned by", meta.engine],
    [
      "This page",
      u ? `${u.inputTokens.toLocaleString("en")} tokens · $${u.costUsd.toFixed(5)}` : "–",
    ],
    ["Planning time", u ? `${u.planningMs} ms` : "–"],
    [
      "Whole site",
      `${meta.situations.toLocaleString("en")} situations · $${meta.totals.costUsd.toFixed(2)} once`,
    ],
    ["To view", "$0, precomputed"],
  ];
  return (
    <dl data-counters="" className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-fd-muted px-3 py-2">
          <dt className="text-xs text-fd-muted-foreground">{k}</dt>
          <dd data-counter={k} className="font-mono tabular-nums">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ViewPreview({
  site,
  view,
  manifests,
  meta,
  device,
}: {
  site: SiteId;
  view: View;
  manifests: ManifestSet;
  meta: SiteMeta;
  device: string;
}) {
  // Each block keeps its identity across views, so the browser can animate it to its new place.
  const names = Object.values(view.plan.layout)
    .flat()
    .map((b) => `[data-w4-block="${b.sourceId}"]{view-transition-name:w4-${b.sourceId}}`)
    .join("");
  return (
    <div
      data-w4-theme={THEMES[site]}
      className={`mx-auto w-full ${DEVICE_WIDTH[device] ?? ""} rounded-2xl bg-background p-3 text-foreground sm:p-5`}
    >
      <style>{names}</style>
      <PlanView
        plan={view.plan}
        data={view.data}
        manifests={manifests}
        registry={defaultRegistry}
      />
      <XRay
        force
        plan={view.plan}
        data={view.data}
        manifests={manifests}
        registry={defaultRegistry}
        calibration={meta.calibration}
        engine={meta.engine}
      />
    </div>
  );
}

function pill(active: boolean, small = false) {
  return `${small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} rounded-full border ${
    active
      ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
      : "border-fd-border hover:bg-fd-accent"
  }`;
}
