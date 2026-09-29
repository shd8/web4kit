import { z } from "zod";
import { bindList } from "../data";
import { Badge, Card, Heading } from "../primitives";
import { defineComponent } from "../registry";

const fp = (m: [number, number], t: [number, number], d: [number, number]) => ({
  mobile: { colSpan: m[0], rowSpan: m[1] },
  tablet: { colSpan: t[0], rowSpan: t[1] },
  desktop: { colSpan: d[0], rowSpan: d[1] },
});

const opt = z.string().optional();
const tags = z.array(z.string()).optional();

export const menuList = defineComponent({
  manifest: {
    id: "menu-list",
    what: "Elegant menu rows: dish, description and price",
    category: "list",
    accepts: [{ shape: "list", requires: ["title"], rank: 1 }],
    affordances: ["browse", "evaluate"],
    footprint: fp([12, 2], [12, 2], [8, 2]),
    mediaHeavy: false,
  },
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          subtitle: opt,
          value: z.union([z.string(), z.number()]).optional(),
          tags,
          badge: opt,
        }),
      )
      .min(1),
  }),
  toProps: (data, binding) => ({ items: bindList(data, binding) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={`${item.title}-${i}`} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg leading-snug">{item.title}</span>
              {item.badge && <Badge tone="primary">{item.badge}</Badge>}
              <span
                aria-hidden
                className="mb-1 min-w-4 flex-1 border-b border-dotted border-border"
              />
              {item.value !== undefined && (
                <span className="shrink-0 font-medium tabular-nums">{item.value}</span>
              )}
            </div>
            {item.subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">{item.subtitle}</p>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  ),
});

export const dataTable = defineComponent({
  manifest: {
    id: "data-table",
    what: "Compact sortable-looking table of rows for comparing values",
    category: "list",
    accepts: [{ shape: "list", requires: ["title"], rank: 8 }],
    affordances: ["compare", "monitor"],
    footprint: fp([12, 2], [12, 2], [8, 2]),
    mediaHeavy: false,
  },
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          subtitle: opt,
          value: z.union([z.string(), z.number()]).optional(),
          badge: opt,
          date: opt,
        }),
      )
      .min(1),
  }),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 12) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <div className="-mx-2">
        <table className="w-full table-auto text-left text-sm">
          <tbody className="divide-y divide-border">
            {items.map((item, i) => (
              <tr key={`${item.title}-${i}`}>
                <td className="min-w-0 px-2 py-2.5 [overflow-wrap:anywhere]">
                  <span className="font-medium">{item.title}</span>
                  {item.subtitle && (
                    <span className="block text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </td>
                {items.some((x) => x.date) && (
                  <td className="hidden px-2 py-2.5 text-muted-foreground tabular-nums @md:table-cell">
                    {item.date}
                  </td>
                )}
                <td className="px-2 py-2.5 text-right">
                  {item.badge ? <Badge tone={toneOf(item.badge)}>{item.badge}</Badge> : null}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium tabular-nums">
                  {item.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  ),
});

export function toneOf(badge: string): "ok" | "warn" | "bad" | "muted" {
  const b = badge.toLowerCase();
  if (/late|delayed|critical|failed|at risk|overdue/.test(b)) return "bad";
  if (/watch|slow|pending|low/.test(b)) return "warn";
  if (/on time|ok|healthy|delivered|good/.test(b)) return "ok";
  return "muted";
}

export const eventsTimeline = defineComponent({
  manifest: {
    id: "events-timeline",
    what: "Upcoming events in date order on a vertical timeline",
    category: "time",
    accepts: [{ shape: "list", requires: ["title", "date"], rank: 2 }],
    affordances: ["browse", "act-soon"],
    footprint: fp([12, 2], [6, 2], [4, 2]),
    mediaHeavy: false,
  },
  props: z.object({
    items: z
      .array(z.object({ title: z.string(), date: z.string(), subtitle: opt, badge: opt }))
      .min(1),
  }),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 5) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <ol className="relative space-y-5 border-l border-border pl-5">
        {items.map((item, i) => (
          <li key={`${item.title}-${i}`} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary"
            />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {item.date}
            </p>
            <p className="mt-0.5 font-medium">{item.title}</p>
            {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
          </li>
        ))}
      </ol>
    </Card>
  ),
});

export const reviewHighlights = defineComponent({
  manifest: {
    id: "review-highlights",
    what: "A few short quotes from reviews with star ratings",
    category: "social-proof",
    accepts: [{ shape: "list", requires: ["body", "rating"], rank: 1 }],
    affordances: ["evaluate"],
    footprint: fp([12, 2], [12, 2], [6, 2]),
    mediaHeavy: false,
  },
  props: z.object({
    items: z
      .array(
        z.object({ body: z.string(), rating: z.number().min(0).max(5), author: opt, date: opt }),
      )
      .min(1),
    average: z.number().optional(),
  }),
  toProps: (data, binding) => {
    const items = bindList(data, binding);
    const ratings = items.map((i) => Number(i.rating)).filter(Number.isFinite);
    return {
      items: items.slice(0, 3),
      average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
    };
  },
  render: ({ items, average }, ctx) => (
    <Card>
      <Heading
        label={ctx.label}
        eyebrow={ctx.eyebrow}
        aside={
          average !== undefined ? (
            <span className="font-display text-3xl tabular-nums">
              {average.toFixed(1)}
              <span className="text-base text-primary"> ★</span>
            </span>
          ) : undefined
        }
      />
      <div className="space-y-4">
        {items.map((item, i) => (
          <blockquote key={i} className="border-l-2 border-primary/60 pl-4">
            <p className="text-[0.95rem] leading-relaxed">“{item.body}”</p>
            <footer className="mt-1 text-xs text-muted-foreground">
              <span className="text-primary">{"★".repeat(Math.round(item.rating))}</span>
              {item.author && <> · {item.author}</>}
              {item.date && <> · {item.date}</>}
            </footer>
          </blockquote>
        ))}
      </div>
    </Card>
  ),
});

export const kpiTiles = defineComponent({
  manifest: {
    id: "kpi-tiles",
    what: "Big headline numbers with labels and change indicators",
    category: "metric",
    accepts: [{ shape: "list", requires: ["title", "value"], rank: 3 }],
    affordances: ["monitor", "highlight"],
    footprint: fp([12, 1], [12, 1], [12, 1]),
    mediaHeavy: false,
  },
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          value: z.union([z.string(), z.number()]),
          subtitle: opt,
          badge: opt,
        }),
      )
      .min(1)
      .max(6),
  }),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 4) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <dl className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
        {items.map((item, i) => (
          <div key={`${item.title}-${i}`} className="min-w-0 rounded-lg bg-muted/60 p-4">
            <dt className="truncate text-xs font-medium text-muted-foreground">{item.title}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight">
              {item.value}
            </dd>
            {item.badge && (
              <dd className="mt-1">
                <Badge tone={toneOf(item.badge)}>{item.badge}</Badge>
              </dd>
            )}
            {item.subtitle && (
              <dd className="mt-1 truncate text-xs text-muted-foreground">{item.subtitle}</dd>
            )}
          </div>
        ))}
      </dl>
    </Card>
  ),
});

export const recordCard = defineComponent({
  manifest: {
    id: "record-card",
    what: "A single short story or announcement with optional image",
    category: "text",
    accepts: [{ shape: "record", requires: ["title"], rank: 1 }],
    affordances: ["highlight", "browse"],
    footprint: fp([12, 1], [12, 1], [6, 1]),
    mediaHeavy: false,
  },
  props: z.object({ title: z.string(), body: opt, badge: opt, image: opt, imageAlt: opt }),
  toProps: (data, binding) =>
    data && typeof data === "object"
      ? Object.fromEntries(
          Object.entries(binding).map(([role, path]) => [
            role,
            (data as Record<string, unknown>)[path],
          ]),
        )
      : {},
  render: (p, ctx) => (
    <Card className="flex flex-col gap-4 @lg:flex-row">
      {p.image && (
        <img
          src={p.image}
          alt={p.imageAlt ?? ""}
          className="aspect-[4/3] w-full shrink-0 rounded-lg object-cover @lg:w-2/5"
          loading="lazy"
        />
      )}
      <div className="min-w-0">
        <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          {ctx.eyebrow ?? ctx.label}
        </p>
        <h3 className="font-display text-2xl leading-tight tracking-tight">{p.title}</h3>
        {p.badge && (
          <div className="mt-2">
            <Badge tone="primary">{p.badge}</Badge>
          </div>
        )}
        {p.body && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>}
      </div>
    </Card>
  ),
});

/** Offer/room cards: image, title, subtitle, price and a badge; ideal for things to choose between. */
export const cardGrid = defineComponent({
  manifest: {
    id: "card-grid",
    what: "Cards with photo, name, short text and price, to compare options",
    category: "list",
    accepts: [{ shape: "list", requires: ["title", "image"], rank: 2 }],
    affordances: ["compare", "browse", "highlight"],
    footprint: fp([12, 2], [12, 2], [12, 2]),
    mediaHeavy: true,
    fallback: "menu-list",
  },
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string(),
          image: z.string().min(1),
          imageAlt: opt,
          subtitle: opt,
          value: z.union([z.string(), z.number()]).optional(),
          badge: opt,
          tags,
        }),
      )
      .min(1),
  }),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 6) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <ul className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {items.map((item, i) => (
          <li
            key={`${item.title}-${i}`}
            className="group min-w-0 overflow-hidden rounded-xl border border-border bg-background"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={item.image}
                alt={item.imageAlt ?? item.title}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
              {item.badge && (
                <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-semibold shadow-sm">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-lg leading-tight">{item.title}</h3>
                {item.value !== undefined && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{item.value}</span>
                )}
              </div>
              {item.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  ),
});
