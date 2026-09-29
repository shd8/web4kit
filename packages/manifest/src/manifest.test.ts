import { describe, expect, it } from "vitest";
import {
  type ComponentManifestInput,
  compatibleComponents,
  type DataSourceManifestInput,
  defineManifests,
  ManifestError,
} from "./index";

const fp = { colSpan: 12, rowSpan: 2 };
const footprint = { mobile: fp, tablet: fp, desktop: fp };

const components: ComponentManifestInput[] = [
  {
    id: "menu-list",
    what: "Rows of dishes with prices",
    accepts: [{ shape: "list", requires: ["title"] }],
    affordances: ["browse"],
    footprint,
    mediaHeavy: false,
  },
  {
    id: "hours-card",
    what: "Opening hours and open status",
    accepts: [{ shape: "schedule" }],
    affordances: ["act-soon"],
    footprint,
    mediaHeavy: false,
  },
  {
    id: "events-timeline",
    what: "Upcoming events in date order",
    accepts: [
      { shape: "list", requires: ["title", "date"] },
      { shape: "schedule", rank: 20 },
    ],
    affordances: ["browse"],
    footprint,
    mediaHeavy: false,
  },
];

const menu: DataSourceManifestInput = {
  id: "menu",
  shape: "list",
  label: "Tonight's menu",
  tags: ["food", "prices"],
  what: "Tonight's dinner menu with dishes and prices",
  not_for: "Lunch service",
  freshness: "daily",
  access: "public",
  fields: { title: { path: "name", trust: "owner" }, value: { path: "price", trust: "owner" } },
  default: { include: true, salience: "standard", region: "primary", prominence: 1 },
  fetch: async () => [],
};

describe("manifest schemas (task 5.1)", () => {
  it("accepts a valid menu manifest as a planning candidate", () => {
    const set = defineManifests({ site: "t", sources: [menu], components });
    expect(set.sources.map((s) => s.id)).toEqual(["menu"]);
    expect(set.sources[0]!.heuristics).toEqual([]);
  });

  it("names the source and field when the default is missing", () => {
    const { default: _omit, ...noDefault } = menu;
    try {
      defineManifests({ site: "t", sources: [noDefault as DataSourceManifestInput], components });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestError);
      expect((e as ManifestError).issues.join("\n")).toMatch(/source menu: default:/);
    }
  });

  it("requires a fallback for media-heavy components", () => {
    const heavy = { ...components[0]!, id: "carousel", mediaHeavy: true };
    expect(() =>
      defineManifests({ site: "t", sources: [menu], components: [...components, heavy] }),
    ).toThrow(/component carousel: fallback required/);
  });
});

describe("description limits (task 5.2)", () => {
  it("fails with the allowed length reported", () => {
    const long = { ...menu, what: "x".repeat(200) };
    expect(() => defineManifests({ site: "t", sources: [long], components })).toThrow(
      /source menu: what: what exceeds 160 characters \(allowed 160, got 200\)/,
    );
  });
});

describe("shape compatibility (task 5.3)", () => {
  it("only offers schedule components to a schedule source", () => {
    const hours: DataSourceManifestInput = { ...menu, id: "hours", shape: "schedule", fields: {} };
    const set = defineManifests({ site: "t", sources: [menu, hours], components });
    const ids = compatibleComponents(set.sources[1]!, set.components).map((c) => c.id);
    expect(ids).toEqual(["hours-card", "events-timeline"]);
    // required roles are respected: the menu has no date, so no timeline
    expect(compatibleComponents(set.sources[0]!, set.components).map((c) => c.id)).toEqual([
      "menu-list",
    ]);
  });
});

describe("versioning (task 5.4)", () => {
  it("changes the version when any manifest changes", () => {
    const a = defineManifests({ site: "t", sources: [menu], components });
    const b = defineManifests({ site: "t", sources: [menu], components });
    expect(a.version).toBe(b.version);
    const edited = components.map((c) =>
      c.id === "menu-list" ? { ...c, affordances: ["browse", "compare"] as const } : c,
    );
    const c = defineManifests({
      site: "t",
      sources: [menu],
      components: edited as ComponentManifestInput[],
    });
    expect(c.version).not.toBe(a.version);
  });
});
