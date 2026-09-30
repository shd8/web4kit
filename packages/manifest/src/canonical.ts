import { z } from "zod";

/**
 * Canonical data for shapes whose structure is fixed. list / media-list / record sources return
 * their own objects and are mapped to component roles through `fields` bindings instead.
 */
export const ScheduleDataSchema = z.object({
  /** `upcoming`: not open yet, as expected (e.g. "Check-in opens at 15:00"); neutral tone. */
  status: z.enum(["open", "upcoming", "closing-soon", "closed"]),
  /** e.g. "Open until 23:00", "Closed · opens tomorrow at 13:00" */
  statusText: z.string(),
  days: z.array(
    z.object({ label: z.string(), hours: z.string(), today: z.boolean().default(false) }),
  ),
});
export type ScheduleData = z.infer<typeof ScheduleDataSchema>;

export const GeoDataSchema = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  directionsUrl: z.string(),
  phone: z.string().optional(),
  /** Render-time only, e.g. "12 min walk". */
  distanceText: z.string().optional(),
  neighbourhood: z.string().optional(),
});
export type GeoData = z.infer<typeof GeoDataSchema>;

export const TimeseriesDataSchema = z.object({
  unit: z.string(),
  series: z
    .array(
      z.object({
        label: z.string(),
        points: z.array(z.object({ t: z.string(), v: z.number() })).min(2),
      }),
    )
    .min(1),
});
export type TimeseriesData = z.infer<typeof TimeseriesDataSchema>;

export const GraphDataSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        group: z.string().optional(),
        status: z.enum(["ok", "warn", "bad"]).optional(),
      }),
    )
    .min(1),
  edges: z.array(
    z.object({ source: z.string(), target: z.string(), label: z.string().optional() }),
  ),
});
export type GraphData = z.infer<typeof GraphDataSchema>;
