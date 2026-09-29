import { GraphDataSchema, TimeseriesDataSchema } from "@web4kit/manifest";
import { Card, Heading } from "../primitives";
import { defineComponent } from "../registry";

const fp = (m: [number, number], t: [number, number], d: [number, number]) => ({
  mobile: { colSpan: m[0], rowSpan: m[1] },
  tablet: { colSpan: t[0], rowSpan: t[1] },
  desktop: { colSpan: d[0], rowSpan: d[1] },
});

const SERIES = ["stroke-primary", "stroke-accent", "stroke-warn", "stroke-muted-foreground"];
const FILLS = ["fill-primary", "fill-accent", "fill-warn", "fill-muted-foreground"];

export const timeseriesChart = defineComponent({
  manifest: {
    id: "timeseries-chart",
    what: "Line chart of values over time, one line per series",
    category: "chart",
    accepts: [{ shape: "timeseries", rank: 1 }],
    affordances: ["monitor", "compare"],
    footprint: fp([12, 2], [12, 2], [8, 2]),
    mediaHeavy: false,
  },
  props: TimeseriesDataSchema,
  toProps: (data) => data,
  render: (d, ctx) => {
    const W = 600;
    const H = 200;
    const pad = { l: 36, r: 8, t: 10, b: 22 };
    const all = d.series.flatMap((s) => s.points.map((p) => p.v));
    const max = Math.max(...all, 0) * 1.1 || 1;
    const min = Math.min(...all, 0);
    const n = Math.max(...d.series.map((s) => s.points.length));
    const x = (i: number) => pad.l + (i / Math.max(n - 1, 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
    const labels = d.series[0]!.points;
    const ticks = [min, (min + max) / 2, max];
    return (
      <Card>
        <Heading
          label={ctx.label}
          eyebrow={ctx.eyebrow}
          aside={
            <ul className="flex flex-wrap justify-end gap-3 text-xs text-muted-foreground">
              {d.series.map((s, i) => (
                <li key={s.label} className="flex items-center gap-1.5">
                  <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                    <circle cx="5" cy="5" r="5" className={FILLS[i % FILLS.length]} />
                  </svg>
                  {s.label}
                </li>
              ))}
            </ul>
          }
        />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${ctx.label} (${d.unit})`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(t)}
                y2={y(t)}
                className="stroke-border"
                strokeDasharray="3 4"
              />
              <text
                x={pad.l - 6}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}
          {labels.map((p, i) =>
            i % Math.ceil(labels.length / 6) === 0 ? (
              <text
                key={p.t}
                x={x(i)}
                y={H - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {p.t}
              </text>
            ) : null,
          )}
          {d.series.map((s, si) => (
            <polyline
              key={s.label}
              points={s.points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")}
              className={`fill-none ${SERIES[si % SERIES.length]}`}
              strokeWidth={si === 0 ? 2.5 : 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </Card>
    );
  },
});

export const graphView = defineComponent({
  manifest: {
    id: "graph-view",
    what: "Network diagram of connected entities with status colours",
    category: "chart",
    accepts: [{ shape: "graph", rank: 1 }],
    affordances: ["explore", "monitor"],
    footprint: fp([12, 3], [12, 3], [8, 3]),
    mediaHeavy: false,
  },
  props: GraphDataSchema,
  toProps: (data) => data,
  render: (g, ctx) => {
    const W = 600;
    const H = 320;
    // Deterministic layout: groups on concentric rings.
    const groups = [...new Set(g.nodes.map((n) => n.group ?? "default"))];
    const pos = new Map<string, { x: number; y: number }>();
    groups.forEach((group, gi) => {
      const members = g.nodes.filter((n) => (n.group ?? "default") === group);
      const r =
        groups.length === 1 ? 120 : 40 + (gi * 100) / Math.max(groups.length - 1, 1) + gi * 20;
      members.forEach((n, i) => {
        const a = (i / members.length) * Math.PI * 2 + gi * 0.6;
        pos.set(n.id, { x: W / 2 + Math.cos(a) * r * 1.6, y: H / 2 + Math.sin(a) * r * 0.85 });
      });
    });
    const tone = { ok: "fill-ok", warn: "fill-warn", bad: "fill-bad" } as const;
    return (
      <Card>
        <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ctx.label}>
          {g.edges.map((e, i) => {
            const a = pos.get(e.source);
            const b = pos.get(e.target);
            return a && b ? (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="stroke-border"
                strokeWidth="1.4"
              />
            ) : null;
          })}
          {g.nodes.map((n) => {
            const p = pos.get(n.id)!;
            return (
              <g key={n.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="9"
                  className={n.status ? tone[n.status] : "fill-primary"}
                />
                <circle cx={p.x} cy={p.y} r="9" className="fill-none stroke-card" strokeWidth="2" />
                <text
                  x={p.x}
                  y={p.y + 22}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-medium"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>
    );
  },
});
