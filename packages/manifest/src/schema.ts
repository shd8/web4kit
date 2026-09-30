import { DEVICES, FootprintSchema, RegionSchema } from "@web4kit/ir";
import { z } from "zod";

export const SHAPES = [
  "list",
  "record",
  "timeseries",
  "schedule",
  "media-list",
  "geo",
  "graph",
] as const;
export const ShapeSchema = z.enum(SHAPES);
export type Shape = z.infer<typeof ShapeSchema>;

export const AFFORDANCES = [
  "highlight",
  "browse",
  "compare",
  "act-soon",
  "evaluate",
  "locate",
  "monitor",
  "explore",
] as const;
export const AffordanceSchema = z.enum(AFFORDANCES);

export const TrustSchema = z.enum(["owner", "system", "third-party"]);
export type Trust = z.infer<typeof TrustSchema>;

export const SALIENCE_LEVELS = ["hidden", "minor", "standard", "featured"] as const;
export const SalienceSchema = z.enum(SALIENCE_LEVELS);
export type Salience = z.infer<typeof SalienceSchema>;

/** 0 = barely visible, 1 = noticeable, 2 = prominent */
export const PROMINENCE_LEVELS = ["barely visible", "noticeable", "prominent"] as const;
export const ProminenceSchema = z.number().int().min(0).max(2);

/** Description limits keep every generated question within the portability contract. */
export const LIMITS = {
  what: 160,
  notFor: 120,
  tag: 24,
  tags: 6,
  componentWhat: 80,
  audience: 160,
  question: 280,
} as const;

const limited = (field: string, max: number) =>
  z
    .string()
    .min(1)
    .max(max, {
      error: (i) =>
        `${field} exceeds ${max} characters (allowed ${max}, got ${String((i.input as string)?.length)})`,
    });

/** Situation condition: every listed bucket must have one of the listed labels. */
export const ConditionSchema = z.record(z.string(), z.array(z.string()).min(1));
export type Condition = z.infer<typeof ConditionSchema>;

/** Manifest-declared heuristics that drive the rules decider (design D5). */
export const HeuristicSchema = z.object({
  when: ConditionSchema,
  relevant: z.boolean().optional(),
  salience: SalienceSchema.optional(),
  region: RegionSchema.optional(),
  prominence: ProminenceSchema.optional(),
  component: z.string().optional(),
});
export type Heuristic = z.infer<typeof HeuristicSchema>;

export const FieldSchema = z.object({ path: z.string().min(1), trust: TrustSchema });

export const AccessSchema = z.union([
  z.literal("public"),
  z.object({ roles: z.array(z.string()).min(1) }),
]);
export type Access = z.infer<typeof AccessSchema>;

export interface FetchContext {
  now: Date;
  timezone?: string;
  locale?: string;
  viewer: { roles: string[] };
  /** Visitor position at render time (never stored in plans). */
  visitorGeo?: { lat: number; lng: number };
  /** Language the content should be presented in (English name, e.g. "english"). */
  language?: string;
  /**
   * The label-only situation the plan was made for (bucket -> English label), so a fetcher can
   * adapt owner-written copy. Fetcher output never reaches a decider.
   */
  situation?: Readonly<Record<string, string>>;
}
export type Fetch = (ctx: FetchContext) => Promise<unknown>;

export const DataSourceManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  shape: ShapeSchema,
  /** Owner-written block heading shown by the renderer (not sent to deciders). */
  label: limited("label", 48),
  /** Optional owner-written kicker above the heading. */
  eyebrow: limited("eyebrow", 32).optional(),
  tags: z.array(limited("tag", LIMITS.tag)).max(LIMITS.tags),
  what: limited("what", LIMITS.what),
  not_for: limited("not_for", LIMITS.notFor).optional(),
  /**
   * Who the source is for, as a situation condition. Rendered into decider questions in one
   * consistent phrasing and applied by the rules engine: written once, it cannot drift.
   */
  audience: ConditionSchema.optional(),
  freshness: z.enum(["live", "daily", "weekly", "static"]),
  access: AccessSchema,
  /** Component input role -> field path and trust level. */
  fields: z.record(z.string(), FieldSchema),
  default: z.object({
    include: z.boolean(),
    salience: SalienceSchema,
    region: RegionSchema,
    prominence: ProminenceSchema,
    component: z.string().optional(),
  }),
  /** Structural invariant: the source must be included whenever this condition holds. */
  mustInclude: ConditionSchema.optional(),
  /** Structural invariant: the source is never placed while this condition holds. */
  mustExclude: ConditionSchema.optional(),
  heuristics: z.array(HeuristicSchema).default([]),
  fetch: z.custom<Fetch>((v) => typeof v === "function", { error: "fetch must be a function" }),
});
export type DataSourceManifest = z.infer<typeof DataSourceManifestSchema>;
export type DataSourceManifestInput = z.input<typeof DataSourceManifestSchema>;

export const ComponentManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  what: limited("what", LIMITS.componentWhat),
  category: z.string().optional(),
  accepts: z
    .array(
      z.object({
        shape: ShapeSchema,
        requires: z.array(z.string()).default([]),
        /** Lower is preferred when choosing a default among compatible components. */
        rank: z.number().default(10),
      }),
    )
    .min(1),
  affordances: z.array(AffordanceSchema).min(1),
  footprint: z.object(
    Object.fromEntries(DEVICES.map((d) => [d, FootprintSchema])) as Record<
      (typeof DEVICES)[number],
      typeof FootprintSchema
    >,
  ),
  mediaHeavy: z.boolean(),
  /** Component used instead when the media budget is low (required when mediaHeavy). */
  fallback: z.string().optional(),
});
export type ComponentManifest = z.infer<typeof ComponentManifestSchema>;
export type ComponentManifestInput = z.input<typeof ComponentManifestSchema>;

export interface ManifestSet {
  site: string;
  /** Full content version (plan cache key). */
  version: string;
  /** Version of the decider-visible surface only (calibration profiles match on it). */
  deciderVersion: string;
  sources: DataSourceManifest[];
  components: ComponentManifest[];
}
