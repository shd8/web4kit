import type { Situation } from "@web4/context";
import { createRuleDecider, type Decider, type RuleResolver, type State } from "@web4/decider";
import {
  type Condition,
  compatibleComponents,
  type DataSourceManifest,
  type Heuristic,
  type ManifestSet,
  SALIENCE_LEVELS,
} from "@web4/manifest";
import { KINDS } from "./questions";

export function matches(condition: Condition, situation: Situation): boolean {
  return Object.entries(condition).every(([bucket, labels]) =>
    labels.includes(situation[bucket] ?? ""),
  );
}

/** Source defaults with every matching heuristic applied in declaration order. */
export function ruleView(source: DataSourceManifest, manifests: ManifestSet, situation: Situation) {
  const view = {
    relevant: source.default.include,
    salience: SALIENCE_LEVELS.indexOf(source.default.salience),
    region: source.default.region as string,
    prominence: source.default.prominence,
    component:
      source.default.component ?? compatibleComponents(source, manifests.components)[0]?.id,
  };
  for (const h of source.heuristics as Heuristic[]) {
    if (!matches(h.when, situation)) continue;
    if (h.relevant !== undefined) view.relevant = h.relevant;
    if (h.salience !== undefined) view.salience = SALIENCE_LEVELS.indexOf(h.salience);
    if (h.region !== undefined) view.region = h.region;
    if (h.prominence !== undefined) view.prominence = h.prominence;
    if (h.component !== undefined) view.component = h.component;
  }
  return view;
}

function situationFromState(state: State): Situation {
  if (!state || typeof state !== "object" || Array.isArray(state)) return {};
  return Object.fromEntries(
    Object.entries(state).filter(([, v]) => typeof v === "string"),
  ) as Situation;
}

/** The rules decider for a manifest set: manifest heuristics and defaults (design D5). */
export function createManifestRuleDecider(manifests: ManifestSet): Decider {
  const byId = new Map(manifests.sources.map((s) => [s.id, s]));
  const componentsById = new Map(manifests.components.map((c) => [c.id, c]));
  const resolve: RuleResolver = (question, state) => {
    const meta = question.meta;
    const source = meta ? byId.get(meta.subject) : undefined;
    if (!meta || !source) return undefined;
    const view = ruleView(source, manifests, situationFromState(state));
    switch (meta.kind) {
      case KINDS.relevance:
        return { type: "noul", value: view.relevant };
      case KINDS.salience:
        return { type: "score", value: view.salience };
      case KINDS.region:
        return { type: "choice", value: view.region };
      case KINDS.prominence:
        return { type: "score", value: view.prominence };
      case KINDS.category: {
        const category = view.component ? componentsById.get(view.component)?.category : undefined;
        return category ? { type: "choice", value: category } : undefined;
      }
      case KINDS.component: {
        if (question.type !== "choice") return undefined;
        const options = Object.keys(question.criteria);
        if (view.component && options.includes(view.component))
          return { type: "choice", value: view.component };
        return undefined; // first option, which is the best-ranked compatible component
      }
      default:
        return undefined;
    }
  };
  return createRuleDecider(resolve);
}
