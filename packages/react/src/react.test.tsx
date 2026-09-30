import { DEVICES, type Plan } from "@web4kit/ir";
import { type DataSourceManifestInput, defineManifests } from "@web4kit/manifest";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  type BlockContext,
  defaultRegistry,
  LIBRARY,
  libraryManifests,
  PlanView,
  resolvePlanData,
} from "./index";

/** Sample data per shape, bound through canonical roles. */
export const SAMPLE: Record<string, { data: unknown; binding: Record<string, string> }> = {
  "media-list": {
    data: Array.from({ length: 6 }, (_, i) => ({
      src: `https://img.example/${i}.jpg`,
      alt: `Dish ${i}`,
      name: `Dish ${i}`,
      text: `Caption ${i} with a few words`,
    })),
    binding: { image: "src", imageAlt: "alt", title: "name", caption: "text" },
  },
  list: {
    data: [
      {
        name: "Grilled octopus",
        desc: "Smoked paprika, potato",
        price: "€24",
        tags: ["gluten-free"],
        when: "Fri 3 Oct",
        rating: 5,
        who: "Ana",
        status: "On time",
        img: "https://img.example/o.jpg",
      },
      {
        name: "Iberian pork",
        desc: "Charred leeks",
        price: "€28",
        tags: [],
        when: "Sat 4 Oct",
        rating: 4,
        who: "Tom",
        status: "Late",
        img: "https://img.example/p.jpg",
      },
    ],
    binding: {
      title: "name",
      subtitle: "desc",
      value: "price",
      tags: "tags",
      date: "when",
      body: "desc",
      rating: "rating",
      author: "who",
      badge: "status",
      image: "img",
    },
  },
  record: {
    data: {
      t: "New: Sunday brunch",
      b: "From 11:00 with live jazz.",
      img: "https://img.example/b.jpg",
    },
    binding: { title: "t", body: "b", image: "img" },
  },
  schedule: {
    data: {
      status: "closed",
      statusText: "Closed · opens tomorrow at 13:00",
      days: [{ label: "Mon", hours: "13:00–16:00 · 20:00–23:00", today: true }],
    },
    binding: {},
  },
  geo: {
    data: {
      name: "Casa Lumbre",
      address: "Calle de Lavapiés 12, Madrid",
      lat: 40.41,
      lng: -3.7,
      directionsUrl: "https://maps.example/?q=x",
      phone: "+34 910 000 000",
      distanceText: "12 min walk",
    },
    binding: {},
  },
  timeseries: {
    data: {
      unit: "orders",
      series: [
        {
          label: "On time",
          points: [
            { t: "W1", v: 10 },
            { t: "W2", v: 14 },
            { t: "W3", v: 12 },
          ],
        },
      ],
    },
    binding: {},
  },
  graph: {
    data: {
      nodes: [
        { id: "a", label: "Acme", status: "ok" },
        { id: "b", label: "Beta", status: "bad" },
      ],
      edges: [{ source: "a", target: "b" }],
    },
    binding: {},
  },
};

describe("registry (task 8.1)", () => {
  it("covers every component manifest and ids are unique", () => {
    const ids = libraryManifests.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(defaultRegistry[id]).toBeDefined();
    // The library validates as a manifest set (fallbacks exist, limits respected).
    expect(() =>
      defineManifests({ site: "lib", sources: [], components: libraryManifests }),
    ).not.toThrow();
  });
});

describe("components at every footprint and device (task 8.2)", () => {
  for (const entry of LIBRARY) {
    it(`${entry.manifest.id} renders with sample data at every declared footprint`, () => {
      const accept = entry.manifest.accepts[0]!;
      const sample = SAMPLE[accept.shape]!;
      const props = entry.props.safeParse(entry.toProps(sample.data, sample.binding));
      expect(props.success, JSON.stringify(props.error?.issues)).toBe(true);
      for (const device of DEVICES) {
        const ctx: BlockContext = {
          label: "Label",
          footprint: entry.manifest.footprint[device],
          device,
        };
        const html = renderToStaticMarkup(
          (entry.render as (p: unknown, c: BlockContext) => React.ReactElement)(props.data, ctx),
        );
        expect(html.length).toBeGreaterThan(50);
        expect(html).toMatch(/min-w-0|overflow-hidden/); // every block is width-contained
      }
    });
  }
});

const src = (
  id: string,
  shape: string,
  over: Partial<DataSourceManifestInput> = {},
): DataSourceManifestInput => ({
  id,
  label: `The ${id}`,
  shape: shape as never,
  tags: [],
  what: `The ${id}`,
  freshness: "daily",
  access: "public",
  fields: Object.fromEntries(
    Object.entries(SAMPLE[shape]!.binding).map(([role, path]) => [
      role,
      { path, trust: "owner" as const },
    ]),
  ),
  default: { include: true, salience: "standard", region: "primary", prominence: 1 },
  fetch: async () => SAMPLE[shape]!.data,
  ...over,
});

let menuItems = [{ name: "Old dish", price: "€10" }];
const manifests = defineManifests({
  site: "render-test",
  components: libraryManifests,
  sources: [
    src("photos", "media-list", {
      default: {
        include: true,
        salience: "featured",
        region: "hero",
        prominence: 2,
        component: "image-grid",
      },
    }),
    src("menu", "list", {
      fields: { title: { path: "name", trust: "owner" }, value: { path: "price", trust: "owner" } },
      fetch: async () => menuItems,
    }),
    src("staff-notes", "record", { access: { roles: ["staff"] } }),
    src("broken", "list", {
      fetch: async () => {
        throw new Error("db down");
      },
    }),
  ],
});

const block = (sourceId: string, componentId: string, binding: Record<string, string>) => ({
  sourceId,
  componentId,
  propsBinding: binding,
  footprint: { colSpan: 12, rowSpan: 2 },
  prominence: 1,
  why: [],
});
const plan = (over: Partial<Plan["layout"]> = {}): Plan => ({
  format: "web4.plan/v1",
  site: "render-test",
  situationHash: "h",
  engine: "rules",
  calibrationVersion: "rules",
  manifestVersion: manifests.version,
  device: "desktop",
  layout: {
    hero: [],
    primary: [block("menu", "menu-list", { title: "name", value: "price" })],
    secondary: [],
    aside: [],
    footer: [],
    ...over,
  },
  excluded: [],
});
const ctx = { now: new Date("2026-09-29T18:00:00Z"), viewer: { roles: [] as string[] } };

describe("render-time data resolution (task 8.3)", () => {
  it("shows updated menu data with a cached plan", async () => {
    const cached = plan();
    const before = renderToStaticMarkup(
      <PlanView
        plan={cached}
        data={await resolvePlanData(cached, manifests, ctx)}
        manifests={manifests}
        registry={defaultRegistry}
      />,
    );
    expect(before).toContain("Old dish");
    menuItems = [{ name: "Charred leeks", price: "€12" }];
    const after = renderToStaticMarkup(
      <PlanView
        plan={cached}
        data={await resolvePlanData(cached, manifests, ctx)}
        manifests={manifests}
        registry={defaultRegistry}
      />,
    );
    expect(after).toContain("Charred leeks");
    expect(after).not.toContain("Old dish");
  });

  it("omits blocks the viewer may not access, without fetching them", async () => {
    const p = plan({ secondary: [block("staff-notes", "record-card", SAMPLE.record!.binding)] });
    const data = await resolvePlanData(p, manifests, ctx);
    expect(data["staff-notes"]).toEqual({ status: "unauthorized" });
    const html = renderToStaticMarkup(
      <PlanView plan={p} data={data} manifests={manifests} registry={defaultRegistry} />,
    );
    expect(html).not.toContain("New: Sunday brunch");
    expect(html).toContain('data-w4-block="menu"');
  });
});

describe("fail-soft blocks (task 8.4)", () => {
  it("falls back from a broken carousel binding while other blocks render", async () => {
    const p = plan({
      hero: [block("photos", "hero-carousel", { image: "missing_field", title: "name" })],
    });
    const data = await resolvePlanData(p, manifests, ctx);
    const rendered: Array<{ sourceId: string; componentId: string | null; fallback?: string }> = [];
    const html = renderToStaticMarkup(
      <PlanView
        plan={p}
        data={data}
        manifests={manifests}
        registry={defaultRegistry}
        onRendered={(r) => rendered.push(...r)}
      />,
    );
    // image-grid also needs an image, so the photos fall back to the text-only caption list
    expect(rendered.find((r) => r.sourceId === "photos")).toMatchObject({
      componentId: "caption-list",
    });
    expect(html).toContain('data-w4-component="caption-list"');
    expect(html).toContain('data-w4-block="menu"');
  });

  it("omits a block whose data fetch fails", async () => {
    const p = plan({ secondary: [block("broken", "menu-list", { title: "name" })] });
    const data = await resolvePlanData(p, manifests, ctx);
    const html = renderToStaticMarkup(
      <PlanView plan={p} data={data} manifests={manifests} registry={defaultRegistry} />,
    );
    expect(html).not.toContain('data-w4-block="broken"');
    expect(html).toContain('data-w4-block="menu"');
  });
});

describe("v1: upcoming schedule status and situation-aware fetch (task 4.1)", () => {
  const render = (id: string, status: string) => {
    const entry = defaultRegistry[id]! as unknown as import("./registry").ComponentEntry<unknown>;
    const props = entry.props.parse(
      entry.toProps({ status, statusText: "Check-in opens at 15:00", days: [] }, {}),
    );
    return renderToStaticMarkup(
      entry.render(props, {
        label: "Check-in",
        footprint: { colSpan: 12, rowSpan: 1 },
        device: "mobile",
      }),
    );
  };

  it("renders upcoming in the primary tone, never the closed tone", () => {
    expect(render("status-banner", "upcoming")).toContain("bg-primary");
    expect(render("status-banner", "upcoming")).not.toContain("bg-foreground");
    expect(render("status-banner", "closed")).toContain("bg-foreground");
    expect(render("hours-card", "upcoming")).toContain("bg-primary");
    expect(render("hours-card", "upcoming")).not.toContain("bg-bad");
  });

  it("passes the planned situation to fetchers", async () => {
    let seen: unknown;
    const set = defineManifests({
      site: "t",
      components: [defaultRegistry["record-card"]!.manifest],
      sources: [
        {
          id: "check-in",
          shape: "record",
          label: "Check-in",
          tags: [],
          what: "Check-in",
          freshness: "live",
          access: "public",
          fields: { title: { path: "t", trust: "owner" } },
          default: { include: true, salience: "standard", region: "primary", prominence: 1 },
          fetch: async (c) => {
            seen = c.situation;
            return { t: c.situation?.stayPhase === "in-house" ? "Check-out until 11:00" : "In" };
          },
        },
      ],
    });
    const p: Plan = {
      ...plan({ primary: [block("check-in", "record-card", { title: "t" })] }),
      manifestVersion: set.version,
    };
    const data = await resolvePlanData(p, set, { ...ctx, situation: { stayPhase: "in-house" } });
    expect(seen).toEqual({ stayPhase: "in-house" });
    expect(data["check-in"]).toEqual({ status: "ok", data: { t: "Check-out until 11:00" } });
  });
});
