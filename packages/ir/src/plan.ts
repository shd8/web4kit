import { z } from "zod";

export const PLAN_FORMAT = "web4.plan/v1" as const;

export const REGIONS = ["hero", "primary", "secondary", "aside", "footer"] as const;
export const RegionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof RegionSchema>;

export const DEVICES = ["mobile", "tablet", "desktop"] as const;
export const DeviceSchema = z.enum(DEVICES);
export type Device = z.infer<typeof DeviceSchema>;

/**
 * `ungated`: an engine answer used without a current calibration threshold. Only plans made in
 * development mode contain it (spec: page-planning, development gating).
 */
export const DecidedBySchema = z.enum(["engine", "default", "rule", "invariant", "ungated"]);
export type DecidedBy = z.infer<typeof DecidedBySchema>;

/** One recorded decision that affected a block or an excluded source. */
export const WhySchema = z.object({
  /** Question kind, e.g. "A.relevance", "B.component", "C.region", or an invariant name. */
  question: z.string(),
  answer: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  threshold: z.number().min(0).max(1).nullable().optional(),
  decidedBy: DecidedBySchema,
  /**
   * Exact engine version when decidedBy is "engine" or "ungated" (or the engine whose answer was
   * overridden).
   */
  engine: z.string().optional(),
  note: z.string().optional(),
});
export type Why = z.infer<typeof WhySchema>;

export const FootprintSchema = z.object({
  colSpan: z.number().int().min(1).max(12),
  rowSpan: z.number().int().min(1).max(4),
});
export type Footprint = z.infer<typeof FootprintSchema>;

export const BlockSchema = z.object({
  sourceId: z.string(),
  componentId: z.string(),
  /** Component input role -> source field path. Data itself is resolved at render time. */
  propsBinding: z.record(z.string(), z.string()),
  footprint: FootprintSchema,
  prominence: z.number(),
  why: z.array(WhySchema),
});
export type Block = z.infer<typeof BlockSchema>;

export const PlanSchema = z.object({
  format: z.literal(PLAN_FORMAT),
  site: z.string(),
  situationHash: z.string(),
  engine: z.string(),
  calibrationVersion: z.string(),
  manifestVersion: z.string(),
  device: DeviceSchema,
  layout: z.object({
    hero: z.array(BlockSchema).max(1),
    primary: z.array(BlockSchema),
    secondary: z.array(BlockSchema),
    aside: z.array(BlockSchema),
    footer: z.array(BlockSchema),
  }),
  excluded: z.array(z.object({ sourceId: z.string(), why: z.array(WhySchema) })),
});
export type Plan = z.infer<typeof PlanSchema>;

/** The published, language-neutral JSON Schema for web4.plan/v1. */
export function planJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(PlanSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
}

export class PlanValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "PlanValidationError";
  }
}

/** Validate an unknown value as a web4 plan. Unsupported versions are rejected by name. */
export function validatePlan(value: unknown): Plan {
  const format = (value as { format?: unknown } | null)?.format;
  if (format !== PLAN_FORMAT) {
    throw new PlanValidationError(`unsupported plan format version: ${String(format)}`);
  }
  const result = PlanSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new PlanValidationError(`invalid plan: ${issues.join("; ")}`, issues);
  }
  return result.data;
}

export function allBlocks(plan: Plan): Block[] {
  return REGIONS.flatMap((r) => plan.layout[r]);
}
