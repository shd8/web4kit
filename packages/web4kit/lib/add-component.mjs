import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { loadFromSite } from "./load.mjs";

export const SHAPES = ["list", "record", "media-list", "schedule", "geo", "timeseries", "graph"];
export const IMPORTS_MARKER = "// web4kit:imports";
export const COMPONENTS_MARKER = "// web4kit:components";
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const words = (name) => name.replace(/-/g, " ");

/**
 * `web4kit add component <name>`: scaffold a component and its test, and register it in the
 * site's component list. Every check runs before anything is written (spec: dev-tooling).
 * @returns exit code
 */
export async function addComponent({
  name,
  shape = "record",
  what,
  dir = "web4/components",
  cwd = process.cwd(),
  load = loadFromSite,
} = {}) {
  if (!name) throw new Error("name the component: web4kit add component <name>");
  if (!NAME.test(name))
    throw new Error(`"${name}" is not a valid component id: use kebab-case, e.g. quote-card`);
  if (!SHAPES.includes(shape))
    throw new Error(`unknown shape "${shape}" (use ${SHAPES.join(", ")})`);

  const base = resolve(cwd, dir);
  const index = join(base, "index.ts");
  const files = {
    component: join(base, `${name}.tsx`),
    test: join(base, `${name}.test.ts`),
  };
  if (!existsSync(index))
    throw new Error(`${relative(cwd, index)} not found: it lists the site's components`);
  const source = readFileSync(index, "utf8");
  for (const marker of [IMPORTS_MARKER, COMPONENTS_MARKER])
    if (!source.includes(marker))
      throw new Error(`${relative(cwd, index)} has no "${marker}" line to register components at`);
  for (const file of Object.values(files))
    if (existsSync(file)) throw new Error(`${relative(cwd, file)} already exists`);
  const { ids } = load("components", relative(cwd, index), cwd);
  if (ids.includes(name))
    throw new Error(`a component with id "${name}" already exists (choose another name)`);

  const id = camel(name);
  const description = what ?? `A ${words(name)} block`;
  writeFileSync(files.component, componentSource({ name, id, shape, what: description }));
  writeFileSync(files.test, testSource({ name, id, shape }));
  writeFileSync(
    index,
    source
      .replace(IMPORTS_MARKER, `import { ${id} } from "./${name}";\n${IMPORTS_MARKER}`)
      .replace(COMPONENTS_MARKER, `${id},\n  ${COMPONENTS_MARKER}`),
  );

  console.log(`✓ Created ${relative(cwd, files.component)} and ${relative(cwd, files.test)}
✓ Registered ${name} in ${relative(cwd, index)}

The planner can now choose ${name} for every ${shape} source whose fields cover its required
roles. Its \`what\` is read by the model literally: describe what it shows${what ? "" : `, then reload\n(it is "${description}" for now)`}.`);
  return 0;
}

/** Per shape: accepted roles, props schema, how data becomes props, sample data, markup. */
const SHAPE_TEMPLATES = {
  record: {
    requires: ["title"],
    imports:
      'import { bindRecord, Card, defineComponent } from "@web4kit/react";\nimport { z } from "zod";',
    props: "z.object({ title: z.string(), body: z.string().optional() })",
    toProps: "(data, binding) => bindRecord(data, binding)",
    body: `<Card>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
        {ctx.eyebrow ?? ctx.label}
      </p>
      <h3 className="text-xl font-semibold">{p.title}</h3>
      {p.body && <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>}
    </Card>`,
    sample: `{ title: "Sample title", body: "Sample text" }`,
    binding: `{ title: "title", body: "body" }`,
  },
  list: {
    requires: ["title"],
    imports:
      'import { bindList, Card, defineComponent, Heading } from "@web4kit/react";\nimport { z } from "zod";',
    props:
      "z.object({ items: z.array(z.object({ title: z.string(), subtitle: z.string().optional() })).min(1) })",
    toProps: "(data, binding) => ({ items: bindList(data, binding) })",
    body: `<Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <ul className="divide-y divide-border">
        {p.items.map((item) => (
          <li key={item.title} className="py-2">
            <p className="font-medium">{item.title}</p>
            {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
          </li>
        ))}
      </ul>
    </Card>`,
    sample: `[{ title: "First item", subtitle: "Detail" }, { title: "Second item" }]`,
    binding: `{ title: "title", subtitle: "subtitle" }`,
  },
  "media-list": {
    requires: ["image"],
    imports:
      'import { bindList, Card, defineComponent, Heading } from "@web4kit/react";\nimport { z } from "zod";',
    props:
      "z.object({ items: z.array(z.object({ image: z.string(), title: z.string().optional() })).min(1) })",
    toProps: "(data, binding) => ({ items: bindList(data, binding) })",
    body: `<Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
        {p.items.map((item) => (
          <img
            key={item.image}
            src={item.image}
            alt={item.title ?? ""}
            loading="lazy"
            className="aspect-square w-full rounded-lg object-cover"
          />
        ))}
      </div>
    </Card>`,
    sample: `[{ image: "https://img.example/1.jpg", title: "One" }]`,
    binding: `{ image: "image", title: "title" }`,
  },
  schedule: canonical(
    "ScheduleDataSchema",
    `<p className="font-medium">{p.statusText}</p>`,
    `{ status: "open", statusText: "Open until 23:00", days: [{ label: "Today", hours: "13:00-23:00", today: true }] }`,
  ),
  geo: canonical(
    "GeoDataSchema",
    `<p className="font-medium">{p.name}</p>
      <p className="text-sm text-muted-foreground">{p.address}</p>`,
    `{ name: "Sample place", address: "1 Main St", lat: 40.4, lng: -3.7, directionsUrl: "https://maps.example" }`,
  ),
  timeseries: canonical(
    "TimeseriesDataSchema",
    `<p className="text-sm text-muted-foreground">
        {p.series.map((s) => s.label).join(", ")} ({p.unit})
      </p>`,
    `{ unit: "orders", series: [{ label: "Orders", points: [{ t: "Mon", v: 3 }, { t: "Tue", v: 5 }] }] }`,
  ),
  graph: canonical(
    "GraphDataSchema",
    `<p className="text-sm text-muted-foreground">
        {p.nodes.length} nodes, {p.edges.length} edges
      </p>`,
    `{ nodes: [{ id: "a", label: "A" }], edges: [] }`,
  ),
};

/** Shapes with a fixed data structure take the canonical data as props. */
function canonical(schema, inner, sample) {
  return {
    requires: [],
    imports: `import { ${schema} } from "@web4kit/manifest";\nimport { Card, defineComponent, Heading } from "@web4kit/react";`,
    props: schema,
    toProps: "(data) => data",
    body: `<Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      ${inner}
    </Card>`,
    sample,
    binding: "{}",
  };
}

function componentSource({ name, id, shape, what }) {
  const t = SHAPE_TEMPLATES[shape];
  return `${t.imports}

/**
 * ${what}. Generated by \`web4kit add component\`: edit the markup freely; keep \`what\` true to
 * what it shows (the model reads it), and \`accepts\` to the data it can render.
 */
export const ${id} = defineComponent({
  manifest: {
    id: "${name}",
    what: ${JSON.stringify(what)},
    accepts: [{ shape: "${shape}", requires: ${JSON.stringify(t.requires)} }],
    affordances: ["highlight"],
    footprint: {
      mobile: { colSpan: 12, rowSpan: 1 },
      tablet: { colSpan: 12, rowSpan: 1 },
      desktop: { colSpan: 6, rowSpan: 1 },
    },
    mediaHeavy: false,
  },
  props: ${t.props},
  toProps: ${t.toProps},
  render: (p, ctx) => (
    ${t.body}
  ),
});
`;
}

function testSource({ name, id, shape }) {
  const t = SHAPE_TEMPLATES[shape];
  return `import { defineManifests } from "@web4kit/manifest";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ${id} } from "./${name}";

describe("${name}", () => {
  it("has a valid manifest", () => {
    const set = defineManifests({ site: "test", sources: [], components: [${id}.manifest] });
    expect(set.components.map((c) => c.id)).toEqual(["${name}"]);
  });

  it("renders sample data", () => {
    const props = ${id}.props.parse(${id}.toProps(${t.sample}, ${t.binding}));
    const ctx = {
      label: "Sample",
      footprint: { colSpan: 12, rowSpan: 1 },
      device: "desktop" as const,
    };
    expect(renderToStaticMarkup(${id}.render(props, ctx))).toContain("Sample");
  });
});
`;
}
