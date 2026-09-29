import { GeoDataSchema, ScheduleDataSchema } from "@web4kit/manifest";
import { ButtonLink, Card, cx, Heading, StatusDot } from "../primitives";
import { defineComponent } from "../registry";

const fp = (m: [number, number], t: [number, number], d: [number, number]) => ({
  mobile: { colSpan: m[0], rowSpan: m[1] },
  tablet: { colSpan: t[0], rowSpan: t[1] },
  desktop: { colSpan: d[0], rowSpan: d[1] },
});

const statusTone = { open: "ok", "closing-soon": "warn", closed: "bad" } as const;

export const hoursCard = defineComponent({
  manifest: {
    id: "hours-card",
    what: "Opening hours for the week with a live open or closed status",
    category: "schedule",
    accepts: [{ shape: "schedule", rank: 1 }],
    affordances: ["act-soon", "locate"],
    footprint: fp([12, 1], [6, 1], [4, 1]),
    mediaHeavy: false,
  },
  props: ScheduleDataSchema,
  toProps: (data) => data,
  render: (s, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <StatusDot tone={statusTone[s.status]} />
        {s.statusText}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
        {s.days.map((d) => (
          <div key={d.label} className={cx("contents", d.today && "font-semibold text-foreground")}>
            <dt className={d.today ? "" : "text-muted-foreground"}>{d.label}</dt>
            <dd className="text-right tabular-nums">{d.hours}</dd>
          </div>
        ))}
      </dl>
    </Card>
  ),
});

/** A bold status banner: the right hero when the venue is closed or about to close. */
export const statusBanner = defineComponent({
  manifest: {
    id: "status-banner",
    what: "Big banner stating open or closed now and the next opening",
    category: "schedule",
    accepts: [{ shape: "schedule", rank: 5 }],
    affordances: ["act-soon", "highlight"],
    footprint: fp([12, 1], [12, 1], [12, 1]),
    mediaHeavy: false,
  },
  props: ScheduleDataSchema,
  toProps: (data) => data,
  render: (s, ctx) => (
    <Card
      tone={s.status === "closed" ? "inverse" : "primary"}
      className="flex flex-col gap-2 @lg:flex-row @lg:items-center @lg:justify-between"
    >
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] opacity-70">
          {ctx.label}
        </p>
        <p className="mt-1 font-display text-3xl leading-tight tracking-tight @lg:text-4xl">
          {s.statusText}
        </p>
      </div>
      <p className="text-sm opacity-80">{s.days.find((d) => d.today)?.hours}</p>
    </Card>
  ),
});

function MapArt({ lat, lng }: { lat: number; lng: number }) {
  // Deterministic stylised street map; no tiles, no third-party requests.
  const seed = Math.abs(Math.round(lat * 1000 + lng * 1000));
  const roads = Array.from({ length: 7 }, (_, i) => ((seed * (i + 3)) % 90) + 5);
  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden
    >
      <rect width="100" height="60" className="fill-muted" />
      <path
        d="M-5 42 C 20 30, 45 55, 105 28"
        className="fill-none stroke-accent/25"
        strokeWidth="7"
      />
      {roads.map((x, i) => (
        <line
          key={`v${i}`}
          x1={x}
          y1="0"
          x2={x + (i % 2 ? 8 : -6)}
          y2="60"
          className="stroke-card"
          strokeWidth={i % 3 ? 1.2 : 2.4}
        />
      ))}
      {roads.slice(0, 5).map((y, i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={(y * 0.6) % 60}
          x2="100"
          y2={((y * 0.6) % 60) + (i % 2 ? 6 : -4)}
          className="stroke-card"
          strokeWidth={i % 2 ? 1.2 : 2}
        />
      ))}
      <circle cx="50" cy="30" r="7" className="fill-primary/20" />
      <circle cx="50" cy="30" r="2.6" className="fill-primary stroke-card" strokeWidth="1" />
    </svg>
  );
}

export const mapCard = defineComponent({
  manifest: {
    id: "map-card",
    what: "Map with address, neighbourhood and a directions button",
    category: "place",
    accepts: [{ shape: "geo", rank: 1 }],
    affordances: ["locate"],
    footprint: fp([12, 2], [6, 2], [4, 2]),
    mediaHeavy: false,
  },
  props: GeoDataSchema,
  toProps: (data) => data,
  render: (g, ctx) => (
    <Card flush>
      <div className="relative h-40">
        <MapArt lat={g.lat} lng={g.lng} />
        {g.distanceText && (
          <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold shadow-sm">
            {g.distanceText}
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          {ctx.label}
        </p>
        <p className="mt-1 font-medium">{g.address}</p>
        {g.neighbourhood && <p className="text-sm text-muted-foreground">{g.neighbourhood}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={g.directionsUrl}>Directions</ButtonLink>
          {g.phone && (
            <ButtonLink href={`tel:${g.phone.replace(/\s/g, "")}`} variant="outline">
              Call
            </ButtonLink>
          )}
        </div>
      </div>
    </Card>
  ),
});

/** Action-first strip for visitors who are nearby and ready to go. */
export const directionsBar = defineComponent({
  manifest: {
    id: "directions-bar",
    what: "Compact strip with distance and big Call and Route buttons",
    category: "place",
    accepts: [{ shape: "geo", rank: 5 }],
    affordances: ["act-soon", "locate"],
    footprint: fp([12, 1], [12, 1], [12, 1]),
    mediaHeavy: false,
  },
  props: GeoDataSchema,
  toProps: (data) => data,
  render: (g, ctx) => (
    <Card className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          {ctx.label}
        </p>
        <p className="mt-1 truncate font-display text-2xl tracking-tight">
          {g.distanceText ?? g.name}
        </p>
        <p className="truncate text-sm text-muted-foreground">{g.address}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {g.phone && (
          <ButtonLink href={`tel:${g.phone.replace(/\s/g, "")}`} variant="outline">
            Call
          </ButtonLink>
        )}
        <ButtonLink href={g.directionsUrl}>Route</ButtonLink>
      </div>
    </Card>
  ),
});
