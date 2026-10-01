import { describe, expect, it } from "vitest";
import {
  type ComponentManifestInput,
  compatibleComponents,
  type DataSourceManifestInput,
  defineManifests,
  defineSource,
  describeAudience,
  ManifestError,
  owner,
  thirdParty,
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

describe("v1 authoring (tasks 2.1-2.3)", () => {
  const set = (source: DataSourceManifestInput) =>
    defineManifests({ site: "t", sources: [source], components });

  it("renders audience in one phrasing, stating the complement", () => {
    expect(describeAudience({ stayPhase: ["researching"] })).toBe(
      "only for visitors whose stayPhase is researching (not for any other stayPhase)",
    );
    expect(
      describeAudience({ stayPhase: ["in-house", "arriving-today"], dayPart: ["morning"] }),
    ).toBe(
      "only for visitors whose stayPhase is in-house or arriving-today and whose dayPart is morning (not for other stayPhase or dayPart values)",
    );
  });

  it("rejects an audience that renders too long", () => {
    const labels = Array.from({ length: 12 }, (_, i) => `label-number-${i}`);
    expect(() => set({ ...menu, audience: { stayPhase: labels } })).toThrow(
      /source menu: audience renders to \d+ characters/,
    );
  });

  it("rejects identical mustInclude and mustExclude", () => {
    expect(() =>
      set({ ...menu, mustInclude: { a: ["x", "y"] }, mustExclude: { a: ["y", "x"] } }),
    ).toThrow(/source menu: mustInclude and mustExclude are identical/);
  });

  it("defineSource fills defaults but never trust", () => {
    const source = defineSource({
      id: "menu",
      shape: "list",
      label: "Menu",
      what: "Dishes",
      fields: { title: owner("name"), body: thirdParty("review") },
      default: { salience: "featured" },
      fetch: async () => [{ name: "Soup" }],
    });
    const parsed = set(source).sources[0]!;
    expect(parsed).toMatchObject({
      access: "public",
      freshness: "static",
      tags: [],
      heuristics: [],
      default: { include: true, salience: "featured", region: "primary", prominence: 1 },
      fields: { body: { trust: "third-party" } },
    });
    expect(() => set({ ...menu, fields: { title: { path: "name" } as never } })).toThrow(
      /source menu: fields.title.trust/,
    );
  });
});

describe("decider version (task 2.2)", () => {
  const base = defineManifests({ site: "t", sources: [menu], components });
  const edited = (patch: Partial<DataSourceManifestInput>) =>
    defineManifests({ site: "t", sources: [{ ...menu, ...patch }], components });

  it("keeps the decider version across cosmetic and rules-only edits", () => {
    for (const patch of [
      { label: "Dinner" },
      { eyebrow: "Tonight" },
      { heuristics: [{ when: { device: ["mobile"] }, salience: "featured" as const }] },
      {
        default: {
          include: false,
          salience: "minor" as const,
          region: "aside" as const,
          prominence: 0,
        },
      },
      { mustInclude: { openState: ["closed"] } },
      { mustExclude: { openState: ["open"] } },
      { freshness: "live" as const },
      {
        fields: {
          title: { path: "other", trust: "system" as const },
          value: { path: "p", trust: "owner" as const },
        },
      },
    ]) {
      const next = edited(patch);
      expect(next.version, JSON.stringify(patch)).not.toBe(base.version);
      expect(next.deciderVersion, JSON.stringify(patch)).toBe(base.deciderVersion);
    }
  });

  it("changes the decider version when decider-visible content changes", () => {
    for (const patch of [
      { what: "Tonight's dinner dishes" },
      { not_for: "Breakfast" },
      { tags: ["food"] },
      { audience: { mealWindow: ["dinner"] } },
      { fields: { title: { path: "name", trust: "owner" as const } } },
    ]) {
      expect(edited(patch).deciderVersion, JSON.stringify(patch)).not.toBe(base.deciderVersion);
    }
    const renamed = defineManifests({
      site: "t",
      sources: [menu],
      components: components.map((c) => (c.id === "menu-list" ? { ...c, what: "Dish rows" } : c)),
    });
    expect(renamed.deciderVersion).not.toBe(base.deciderVersion);
  });
});

describe("per-source decider versions (dx-dev-loop 1.1)", () => {
  const hours: DataSourceManifestInput = {
    ...menu,
    id: "hours",
    shape: "schedule",
    what: "Opening hours",
    fields: {},
  };
  const base = defineManifests({ site: "t", sources: [menu, hours], components });

  it("has one version per source", () => {
    expect(Object.keys(base.sourceDeciderVersions).sort()).toEqual(["hours", "menu"]);
  });

  it("changes only the edited source's version", () => {
    const next = defineManifests({
      site: "t",
      sources: [{ ...menu, what: "Tonight's dinner dishes" }, hours],
      components,
    });
    expect(next.sourceDeciderVersions.menu).not.toBe(base.sourceDeciderVersions.menu);
    expect(next.sourceDeciderVersions.hours).toBe(base.sourceDeciderVersions.hours);
  });

  it("changes exactly the sources compatible with an edited component", () => {
    const next = defineManifests({
      site: "t",
      sources: [menu, hours],
      components: components.map((c) => (c.id === "menu-list" ? { ...c, what: "Dish rows" } : c)),
    });
    expect(next.sourceDeciderVersions.menu).not.toBe(base.sourceDeciderVersions.menu);
    expect(next.sourceDeciderVersions.hours).toBe(base.sourceDeciderVersions.hours);
  });

  it("keeps every version across a label edit", () => {
    const next = defineManifests({
      site: "t",
      sources: [{ ...menu, label: "Dinner" }, hours],
      components,
    });
    expect(next.sourceDeciderVersions).toEqual(base.sourceDeciderVersions);
  });
});
