import type { Situation } from "@web4kit/context";
import type { Json, Question, Questions, State } from "@web4kit/decider";
import type { Region } from "@web4kit/ir";
import {
  type ComponentManifest,
  compatibleComponents,
  type DataSourceManifest,
  describeAudience,
  type ManifestSet,
  PROMINENCE_LEVELS,
  SALIENCE_LEVELS,
} from "@web4kit/manifest";

export const KINDS = {
  relevance: "A.relevance",
  salience: "A.salience",
  component: "B.component",
  category: "B.category",
  region: "C.region",
  prominence: "C.prominence",
} as const;
export type QuestionKind = (typeof KINDS)[keyof typeof KINDS];

/** Portability contract (Laya-class limits, design D6). */
export const PORTABILITY = {
  maxStateTokens: 512,
  /** Strictly fewer than 20 options per choice. */
  maxChoiceOptions: 19,
  maxCriteriaTokens: 192,
} as const;
export type PortabilityLimits = {
  maxStateTokens: number;
  maxChoiceOptions: number;
  maxCriteriaTokens: number;
};

const VISITOR = "the visitor described in the state";

const REGION_CRITERIA: Record<Region, string> = {
  hero: "Top of page, the single most important block",
  primary: "Main content, right below the top",
  secondary: "Supporting content further down",
  aside: "Side column for quick reference",
  footer: "Bottom of page, rarely needed",
};

const SALIENCE_CRITERIA = [
  "hidden: not worth showing",
  "minor: small, low on the page",
  "standard: a normal block",
  "featured: one of the most important blocks",
];

const PROMINENCE_CRITERIA = PROMINENCE_LEVELS.map((l) => `${l} within its area`);

/** First-party free text that may enter the state (the explorer's typed question). */
export interface Intent {
  text: string;
  language: string;
}

export const INTENT_MAX_CHARS = 280;

/** Decider state: situation labels only, plus a length-capped first-party intent if given. */
export function buildState(situation: Situation, intent?: Intent): State {
  const state: Record<string, Json> = { ...situation };
  if (intent) state.visitor_request = intent.text.slice(0, INTENT_MAX_CHARS);
  return state;
}

/**
 * Manifest-level summary of a candidate. Built only from owner-written semantics: never from
 * fetched data, field values, or third-party content (JevOut defense, design D5).
 */
export function sourceSummary(source: DataSourceManifest): Json {
  const summary: Record<string, Json> = { id: source.id, what: source.what };
  if (source.audience) summary.audience = describeAudience(source.audience);
  if (source.not_for) summary.not_for = source.not_for;
  if (source.tags.length) summary.tags = source.tags;
  return summary;
}

export interface QuestionIndexEntry {
  kind: QuestionKind;
  sourceId: string;
  /** For within-category component questions. */
  category?: string;
}

export interface QuestionPlan {
  state: State;
  questions: Questions;
  index: Record<string, QuestionIndexEntry>;
  /** Components offered per source (after shape prefiltering). */
  compatible: Record<string, ComponentManifest[]>;
  /** Categories used for hierarchical choice, per source. */
  hierarchy: Record<string, Record<string, ComponentManifest[]>>;
}

export class PortabilityError extends Error {
  constructor(readonly issues: string[]) {
    super(`portability contract violated:\n  - ${issues.join("\n  - ")}`);
    this.name = "PortabilityError";
  }
}

export const qid = (kind: QuestionKind, sourceId: string, category?: string) =>
  category ? `${kind}:${sourceId}:${category}` : `${kind}:${sourceId}`;

/**
 * Generate every Stage A/B/C question for every candidate in one logical round (design D6).
 * No question depends on another's answer.
 */
export function buildQuestions(
  manifests: ManifestSet,
  situation: Situation,
  options: { intent?: Intent; limits?: PortabilityLimits } = {},
): QuestionPlan {
  const limits = options.limits ?? PORTABILITY;
  const state = buildState(situation, options.intent);
  const questions: Questions = {};
  const index: Record<string, QuestionIndexEntry> = {};
  const compatible: QuestionPlan["compatible"] = {};
  const hierarchy: QuestionPlan["hierarchy"] = {};

  const add = (id: string, entry: QuestionIndexEntry, question: Question) => {
    questions[id] = { ...question, meta: { kind: entry.kind, subject: entry.sourceId } };
    index[id] = entry;
  };

  for (const source of manifests.sources) {
    const summary = sourceSummary(source);
    const ask = (question: string) => ({ question, source: summary });
    const sourceId = source.id;

    add(
      qid(KINDS.relevance, sourceId),
      { kind: KINDS.relevance, sourceId },
      {
        type: "noul",
        instructions: ask(`Is this data source relevant to show to ${VISITOR}?`),
      },
    );
    add(
      qid(KINDS.salience, sourceId),
      { kind: KINDS.salience, sourceId },
      {
        type: "score",
        instructions: ask(`How important is this data source for ${VISITOR}?`),
        criteria: SALIENCE_CRITERIA,
      },
    );

    const comps = compatibleComponents(source, manifests.components);
    compatible[sourceId] = comps;
    const componentQuestion = `Which component best presents this data source to ${VISITOR}?`;
    if (comps.length > limits.maxChoiceOptions && comps.every((c) => c.category)) {
      const groups: Record<string, ComponentManifest[]> = {};
      for (const c of comps) {
        const group = groups[c.category!] ?? [];
        group.push(c);
        groups[c.category!] = group;
      }
      hierarchy[sourceId] = groups;
      add(
        qid(KINDS.category, sourceId),
        { kind: KINDS.category, sourceId },
        {
          type: "choice",
          instructions: ask(
            `Which kind of component best presents this data source to ${VISITOR}?`,
          ),
          criteria: Object.fromEntries(
            Object.entries(groups).map(([cat, cs]) => [cat, cs.map((c) => c.id).join(", ")]),
          ),
        },
      );
      for (const [category, cs] of Object.entries(groups)) {
        if (cs.length < 2) continue;
        add(
          qid(KINDS.component, sourceId, category),
          { kind: KINDS.component, sourceId, category },
          {
            type: "choice",
            instructions: ask(componentQuestion),
            criteria: componentCriteria(cs),
          },
        );
      }
    } else if (comps.length > 1) {
      add(
        qid(KINDS.component, sourceId),
        { kind: KINDS.component, sourceId },
        {
          type: "choice",
          instructions: ask(componentQuestion),
          criteria: componentCriteria(comps),
        },
      );
    }

    add(
      qid(KINDS.region, sourceId),
      { kind: KINDS.region, sourceId },
      {
        type: "choice",
        instructions: ask(`Where on the page should this data source be placed for ${VISITOR}?`),
        criteria: REGION_CRITERIA,
      },
    );
    add(
      qid(KINDS.prominence, sourceId),
      { kind: KINDS.prominence, sourceId },
      {
        type: "score",
        instructions: ask(`How visually prominent should this data source be for ${VISITOR}?`),
        criteria: PROMINENCE_CRITERIA,
      },
    );
  }
  return { state, questions, index, compatible, hierarchy };
}

function componentCriteria(components: ComponentManifest[]): Record<string, Json> {
  return Object.fromEntries(components.map((c) => [c.id, c.what]));
}

export const SALIENCE = SALIENCE_LEVELS;
