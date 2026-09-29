import { z } from "zod";

/** Any JSON value. Instructions and criteria accept structured JSON (System One "advanced: structure"). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ]),
);

/** web4-side metadata attached to a question. Never sent over the wire. */
export const QuestionMetaSchema = z.object({
  /** Stage-level question kind, e.g. "A.relevance", "B.component", "C.region". */
  kind: z.string(),
  /** What the question is about, e.g. a data source id. */
  subject: z.string(),
});
export type QuestionMeta = z.infer<typeof QuestionMetaSchema>;

export const ChoiceQuestionSchema = z.object({
  type: z.literal("choice"),
  instructions: JsonSchema,
  criteria: z.record(z.string(), JsonSchema),
  meta: QuestionMetaSchema.optional(),
});
export const ScoreQuestionSchema = z.object({
  type: z.literal("score"),
  instructions: JsonSchema,
  criteria: z.array(JsonSchema).min(2),
  meta: QuestionMetaSchema.optional(),
});
export const NoulQuestionSchema = z.object({
  type: z.literal("noul"),
  instructions: JsonSchema,
  criteria: JsonSchema.optional(),
  meta: QuestionMetaSchema.optional(),
});
export const QuestionSchema = z.discriminatedUnion("type", [
  ChoiceQuestionSchema,
  ScoreQuestionSchema,
  NoulQuestionSchema,
]);
export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>;
export type ScoreQuestion = z.infer<typeof ScoreQuestionSchema>;
export type NoulQuestion = z.infer<typeof NoulQuestionSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Questions = Record<string, Question>;

export const StateSchema = z.union([
  z.string(),
  z.array(JsonSchema),
  z.record(z.string(), JsonSchema),
]);
export type State = z.infer<typeof StateSchema>;

/** Where an answer came from. */
export interface Provenance {
  /** Pinned id of the engine that produced the answer, e.g. "jev-1.13.0" or "rules". */
  engine: string;
  /** Set when a fallback engine answered because the primary failed. */
  fallbackReason?: string;
}

interface AnswerBase {
  /** Confidence computed by web4 from probabilities (engine-independent, used for gating). */
  confidence: number;
  /** Confidence as reported by the engine, recorded but never used for gating. */
  engineConfidence?: number;
  provenance: Provenance;
}
export interface ChoiceAnswer extends AnswerBase {
  type: "choice";
  value: string;
  probabilities: Record<string, number>;
}
export interface ScoreAnswer extends AnswerBase {
  type: "score";
  /** Expected level (may fall between levels). */
  value: number;
  /** Probability per level index ("0", "1", ...). */
  probabilities: Record<string, number>;
}
export interface NoulAnswer extends AnswerBase {
  type: "noul";
  /** Probability that the statement is true. */
  value: number;
  probabilities: { true: number; false: number };
}
export interface Unanswered {
  type: "unanswered";
  reason: string;
  provenance: Provenance;
}
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;
export type AnswerOrUnanswered = Answer | Unanswered;

export interface AnswerSet {
  answers: Record<string, AnswerOrUnanswered>;
  /** Exact engine version that answered (never an alias). */
  engineVersion: string;
  usage: { inputTokens: number; requests: number };
}

export const CapabilitiesSchema = z.object({
  maxStateTokens: z.number().int().positive(),
  maxRequestTokens: z.number().int().positive(),
  maxQuestionsPerRequest: z.number().int().positive(),
  maxChoiceOptions: z.number().int().positive(),
  maxCriteriaTokens: z.number().int().positive(),
  primitives: z.array(z.enum(["choice", "score", "noul"])),
  languages: z.array(z.string()),
  modalities: z.array(z.enum(["text", "image"])),
  locality: z.enum(["cloud", "local", "browser"]),
  deterministic: z.union([z.boolean(), z.literal("unknown")]),
  p50LatencyMs: z.number().nonnegative(),
  costPerMTok: z.number().nonnegative(),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export interface DecideOptions {
  signal?: AbortSignal;
}

/** The web4 decision interface over System One (Jev-like) engines. */
export interface Decider {
  /** Pinned engine identity, e.g. "jev-1.13.0", "ollaya:laya:en@<sha>", "rules". */
  readonly id: string;
  readonly capabilities: Capabilities;
  decide(state: State, questions: Questions, options?: DecideOptions): Promise<AnswerSet>;
}

/** Aliases that float between versions and therefore cannot identify a calibrated engine. */
const FLOATING_ALIAS = /(^|[-:@])(latest|preview|default)$/;
export function isFloatingAlias(model: string): boolean {
  return FLOATING_ALIAS.test(model);
}
