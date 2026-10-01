import type { QueryClient } from "@tanstack/react-query";
import type { Plan } from "@web4kit/ir";
import type { ManifestSet } from "@web4kit/manifest";
import type { PlanData, SourceData } from "@web4kit/react";

/** Static playground bundles written by the precompute (design D2). */
export const SITES = ["restaurant", "hotel", "welcome"] as const;
export type SiteId = (typeof SITES)[number];

/** The theme each demo site is designed in. */
export const THEMES: Record<SiteId, string> = {
  restaurant: "lumbre",
  hotel: "azulejo",
  welcome: "ops",
};

export interface Control {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}
export type Values = Record<string, string>;

export interface SiteIndex {
  site: SiteId;
  title: string;
  controls: Control[];
  personas: Array<{ name: string; title: string; values: Values }>;
  plans: string[];
  dataSets: Array<Record<string, string>>;
  /** Dense, in combination order (first control varies slowest): [plan, dataSet]. */
  entries: Array<[number, number]>;
}

export interface PlanUsage {
  inputTokens: number;
  requests: number;
  planningMs: number;
  costUsd: number;
}

export interface SiteMeta {
  engine: string;
  calibration: { status: string; version?: string; staleSources?: string[] };
  generatedAt: string | null;
  combinations: number;
  situations: number;
  totals: { inputTokens: number; requests: number; costUsd: number };
  plans: Record<string, PlanUsage>;
}

export interface View {
  planHash: string;
  plan: Plan;
  data: PlanData;
  usage: PlanUsage | undefined;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const url = (site: SiteId, path: string) => `${BASE}/playground/${site}/${path}`;

async function json<T>(href: string): Promise<T> {
  const res = await fetch(href);
  if (!res.ok) throw new Error(`${href}: ${res.status}`);
  return (await res.json()) as T;
}

/** Position of a combination in `entries`, from its option indices. */
export function entryIndex(index: Pick<SiteIndex, "controls">, values: Values): number {
  let position = 0;
  for (const control of index.controls) {
    const i = control.options.findIndex((o) => o.value === values[control.id]);
    if (i < 0) throw new Error(`no option ${values[control.id]} for ${control.id}`);
    position = position * control.options.length + i;
  }
  return position;
}

/** Which plan and data set a combination uses. */
export function viewRefs(index: SiteIndex, values: Values) {
  const [p, d] = index.entries[entryIndex(index, values)]!;
  return { planHash: index.plans[p]!, dataSet: index.dataSets[d]! };
}

/** Default values: the site's first persona, or every control's first option. */
export function defaultValues(index: SiteIndex): Values {
  return (
    index.personas[0]?.values ??
    Object.fromEntries(index.controls.map((c) => [c.id, c.options[0]!.value]))
  );
}

/** Values from a URL query, falling back to the defaults for anything missing or unknown. */
export function valuesFromQuery(index: SiteIndex, query: URLSearchParams): Values {
  const defaults = defaultValues(index);
  return Object.fromEntries(
    index.controls.map((c) => {
      const v = query.get(c.id);
      return [c.id, v && c.options.some((o) => o.value === v) ? v : defaults[c.id]!];
    }),
  );
}

// Query options: bundles never change for a build, so nothing goes stale.
const forever = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY };

export const siteQuery = (site: SiteId) => ({
  queryKey: ["playground", site, "site"] as const,
  queryFn: async () => {
    const [index, manifests, meta] = await Promise.all([
      json<SiteIndex>(url(site, "index.json")),
      json<ManifestSet>(url(site, "manifests.json")),
      json<SiteMeta>(url(site, "meta.json")),
    ]);
    return { index, manifests, meta };
  },
  ...forever,
});

/** Situation labels per plan (docs embeds). */
export const situationsQuery = (site: SiteId) => ({
  queryKey: ["playground", site, "situations"] as const,
  queryFn: () => json<Record<string, Record<string, string>>>(url(site, "situations.json")),
  ...forever,
});

const planQuery = (site: SiteId, hash: string) => ({
  queryKey: ["playground", site, "plan", hash] as const,
  queryFn: () => json<Plan>(url(site, `plans/${hash}.json`)),
  ...forever,
});

const dataQuery = (site: SiteId, hash: string) => ({
  queryKey: ["playground", site, "data", hash] as const,
  queryFn: () => json<SourceData>(url(site, `data/${hash}.json`)),
  ...forever,
});

export const viewQuery = (qc: QueryClient, site: SiteId, values: Values) => ({
  queryKey: ["playground", site, "view", values] as const,
  queryFn: async (): Promise<View> => {
    const { index, meta } = await qc.ensureQueryData(siteQuery(site));
    const { planHash, dataSet: set } = viewRefs(index, values);
    const [plan, ...entries] = await Promise.all([
      qc.ensureQueryData(planQuery(site, planHash)),
      ...Object.entries(set).map(async ([sourceId, hash]) => {
        const data = await qc.ensureQueryData(dataQuery(site, hash));
        return [sourceId, data] as const;
      }),
    ]);
    return { planHash, plan, data: Object.fromEntries(entries), usage: meta.plans[planHash] };
  },
  ...forever,
});
