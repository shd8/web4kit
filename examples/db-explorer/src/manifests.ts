import { type DataSourceManifestInput, defineManifests } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";
import {
  BRIEFING,
  LANES,
  MARGINS,
  ON_TIME_TREND,
  ORDER_VOLUME,
  PRODUCTS,
  SHIPMENTS,
  SUPPLIERS,
  WAREHOUSES,
} from "./data";

const f = (path: string) => ({ path, trust: "system" as const });
const pct = (x: number) => `${Math.round(x * 100)}%`;
const supplierBadge = (onTime: number) =>
  onTime >= 0.9 ? "On time" : onTime >= 0.8 ? "Watch" : "At risk";

export const sources: DataSourceManifestInput[] = [
  {
    id: "kpis",
    shape: "list",
    label: "This week at a glance",
    tags: ["kpi", "summary", "overview"],
    what: "Headline numbers: on-time rate, late shipments, open orders and lead time",
    not_for: "Detail on a single supplier or product",
    freshness: "live",
    access: "public",
    fields: { title: f("label"), value: f("value"), badge: f("badge"), subtitle: f("note") },
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "kpi-tiles",
    },
    heuristics: [
      { when: { role: ["ops-manager"] }, salience: "featured", region: "hero", prominence: 2 },
      { when: { role: ["executive"] }, salience: "featured", region: "primary", prominence: 2 },
      { when: { role: ["analyst"] }, salience: "minor", region: "secondary", prominence: 0 },
    ],
    fetch: async () => [
      { label: "On-time delivery", value: "86.4%", badge: "Watch", note: "−2.1 pts vs last week" },
      {
        label: "Late shipments",
        value: String(SHIPMENTS.length),
        badge: "Late",
        note: "4 into Madrid DC",
      },
      {
        label: "Open orders",
        value: String(SUPPLIERS.reduce((a, s) => a + s.open, 0)),
        note: "across 7 suppliers",
      },
      { label: "Avg lead time", value: "9.2 d", badge: "OK", note: "target 10 d" },
    ],
  },
  {
    id: "late-shipments",
    shape: "list",
    label: "Late shipments",
    eyebrow: "Needs action",
    tags: ["shipments", "delays", "late", "logistics"],
    what: "Shipments running late now, with supplier, lane, new ETA and days of delay",
    not_for: "Long-term trends or revenue",
    freshness: "live",
    access: "public",
    fields: {
      title: f("id"),
      subtitle: f("detail"),
      date: f("eta"),
      badge: f("delay"),
      value: f("supplier"),
    },
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "data-table",
    },
    heuristics: [
      { when: { role: ["ops-manager"] }, salience: "featured", region: "primary", prominence: 2 },
      { when: { role: ["executive"] }, salience: "minor", region: "secondary", prominence: 0 },
    ],
    fetch: async () =>
      SHIPMENTS.map((s) => ({
        id: s.id,
        detail: s.lane,
        eta: s.eta,
        delay: `Late ${s.delayDays} d`,
        supplier: s.supplier,
      })),
  },
  {
    id: "supplier-status",
    shape: "list",
    label: "Supplier reliability",
    tags: ["suppliers", "on-time", "reliability", "performance"],
    what: "Each supplier's on-time rate this month with a status of on time, watch or at risk",
    not_for: "Individual shipments",
    freshness: "daily",
    access: "public",
    fields: { title: f("name"), subtitle: f("meta"), value: f("rate"), badge: f("status") },
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "data-table",
    },
    heuristics: [
      { when: { role: ["analyst"] }, salience: "featured", region: "primary", prominence: 2 },
      { when: { role: ["executive"] }, salience: "minor", region: "secondary", prominence: 0 },
    ],
    fetch: async () =>
      [...SUPPLIERS]
        .sort((a, b) => a.onTime - b.onTime)
        .map((s) => ({
          name: s.name,
          meta: `${s.country} · ${s.open} open orders`,
          rate: pct(s.onTime),
          status: supplierBadge(s.onTime),
        })),
  },
  {
    id: "supply-network",
    shape: "graph",
    label: "Supply network",
    tags: ["network", "suppliers", "warehouses", "graph"],
    what: "Graph of suppliers and the warehouses they deliver to, coloured by health",
    not_for: "Exact numbers or trends",
    freshness: "daily",
    access: "public",
    fields: {},
    default: {
      include: true,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "graph-view",
    },
    heuristics: [
      { when: { role: ["analyst"] }, salience: "standard", region: "primary", prominence: 1 },
      { when: { role: ["executive"] }, relevant: false },
      { when: { device: ["mobile"] }, salience: "minor", region: "secondary", prominence: 0 },
    ],
    fetch: async () => ({
      nodes: [
        ...SUPPLIERS.map((s) => ({
          id: s.id,
          label: s.name.split(" ")[0]!,
          group: "supplier",
          status:
            s.onTime >= 0.9
              ? ("ok" as const)
              : s.onTime >= 0.8
                ? ("warn" as const)
                : ("bad" as const),
        })),
        ...WAREHOUSES.map((w) => ({
          id: w.id,
          label: w.name,
          group: "warehouse",
          status: w.status,
        })),
      ],
      edges: LANES.map(([source, target]) => ({ source, target })),
    }),
  },
  {
    id: "on-time-trend",
    shape: "timeseries",
    label: "On-time delivery by region",
    eyebrow: "Last 12 weeks",
    tags: ["trend", "on-time", "regions", "weekly"],
    what: "Weekly on-time delivery percentage per region over the last twelve weeks",
    not_for: "Today's individual shipments",
    freshness: "daily",
    access: "public",
    fields: {},
    default: {
      include: true,
      salience: "standard",
      region: "primary",
      prominence: 1,
      component: "timeseries-chart",
    },
    heuristics: [
      { when: { role: ["analyst"] }, salience: "featured", region: "primary", prominence: 2 },
      { when: { role: ["executive"] }, salience: "standard", region: "primary", prominence: 1 },
      { when: { role: ["ops-manager"] }, salience: "minor", region: "secondary", prominence: 0 },
    ],
    fetch: async () => ON_TIME_TREND,
  },
  {
    id: "order-volume",
    shape: "timeseries",
    label: "Order volume",
    eyebrow: "Year over year",
    tags: ["orders", "volume", "demand", "weekly"],
    what: "Orders per week this year compared with last year",
    not_for: "Delivery performance",
    freshness: "daily",
    access: "public",
    fields: {},
    default: {
      include: false,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "timeseries-chart",
    },
    heuristics: [
      {
        when: { role: ["analyst", "executive"] },
        relevant: true,
        salience: "standard",
        region: "secondary",
        prominence: 1,
      },
    ],
    fetch: async () => ORDER_VOLUME,
  },
  {
    id: "top-products",
    shape: "list",
    label: "Top products",
    tags: ["products", "revenue", "sales"],
    what: "Best-selling products this quarter by units and revenue",
    not_for: "Delivery delays or supplier reliability",
    freshness: "daily",
    access: "public",
    fields: { title: f("name"), subtitle: f("sku"), value: f("revenue") },
    default: {
      include: false,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "data-table",
    },
    heuristics: [
      {
        when: { role: ["executive", "analyst"] },
        relevant: true,
        salience: "minor",
        region: "secondary",
        prominence: 0,
      },
    ],
    fetch: async () =>
      PRODUCTS.map((p) => ({
        name: p.name,
        sku: `${p.sku} · ${p.units.toLocaleString("en")} units`,
        revenue: p.revenue,
      })),
  },
  {
    id: "inventory-risk",
    shape: "list",
    label: "Stock at risk",
    tags: ["inventory", "stock", "cover", "risk"],
    what: "Products with few days of stock cover left, lowest first",
    not_for: "Revenue or long-term trends",
    freshness: "live",
    access: "public",
    fields: { title: f("name"), subtitle: f("sku"), value: f("cover"), badge: f("status") },
    default: {
      include: true,
      salience: "minor",
      region: "aside",
      prominence: 0,
      component: "data-table",
    },
    heuristics: [
      { when: { role: ["ops-manager"] }, salience: "standard", region: "aside", prominence: 1 },
      { when: { role: ["executive"] }, relevant: false },
    ],
    fetch: async () =>
      PRODUCTS.filter((p) => p.cover < 15)
        .sort((a, b) => a.cover - b.cover)
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          cover: `${p.cover} d`,
          status: p.cover < 7 ? "Low" : "Watch",
        })),
  },
  {
    id: "margins",
    shape: "list",
    label: "Margin by supplier",
    eyebrow: "Finance",
    tags: ["margin", "finance", "suppliers"],
    what: "Gross margin per supplier this quarter",
    not_for: "Operations or delivery status",
    freshness: "weekly",
    access: { roles: ["analyst", "executive"] },
    fields: { title: f("name"), value: f("margin"), badge: f("trend") },
    default: {
      include: false,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "data-table",
    },
    heuristics: [
      {
        when: { role: ["executive"] },
        relevant: true,
        salience: "standard",
        region: "secondary",
        prominence: 1,
      },
    ],
    fetch: async () => MARGINS,
  },
  {
    id: "briefing",
    shape: "record",
    label: "Weekly briefing",
    tags: ["summary", "briefing", "news"],
    what: "A short written summary of the week's main story, written for executives",
    not_for: "Ops managers and analysts, who need the detailed views instead",
    freshness: "weekly",
    access: "public",
    fields: { title: f("title"), body: f("body") },
    default: {
      include: false,
      salience: "minor",
      region: "secondary",
      prominence: 0,
      component: "record-card",
    },
    heuristics: [
      {
        when: { role: ["executive"] },
        relevant: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
      },
    ],
    fetch: async () => BRIEFING,
  },
];

export const manifests = defineManifests({
  site: "meridian-ops",
  sources,
  components: libraryManifests,
});
