import {
  CORE_BUCKETS,
  CORE_RULES,
  type ContextEnvelope,
  deriveSituation,
  type SituationRule,
  UNKNOWN,
} from "@web4kit/context";
export const ROLES = ["ops-manager", "analyst", "executive"] as const;

/** Role comes from the authenticated first-party session (envelope.roles). */
export const roleRule: SituationRule = (env) => {
  const role = env.roles?.find((r) => (ROLES as readonly string[]).includes(r));
  return { role: role ?? UNKNOWN };
};

export const RULES: SituationRule[] = [...CORE_RULES, roleRule];
export const BUCKETS = { ...CORE_BUCKETS, role: ROLES };

export function situationOf(envelope: ContextEnvelope) {
  const {
    arrival: _arrival,
    familiarity: _familiarity,
    ...situation
  } = deriveSituation(envelope, RULES);
  return situation; // arrival and visit memory carry no meaning inside an internal tool
}

const STOPWORDS: Record<string, string[]> = {
  english: [
    "the",
    "which",
    "what",
    "are",
    "is",
    "this",
    "month",
    "show",
    "me",
    "how",
    "late",
    "our",
    "of",
    "and",
    "who",
    "why",
  ],
  spanish: [
    "qué",
    "que",
    "cuáles",
    "cuales",
    "los",
    "las",
    "este",
    "mes",
    "proveedores",
    "llegan",
    "tarde",
    "muéstrame",
    "cómo",
    "por",
    "del",
    "de",
  ],
  german: [
    "welche",
    "lieferanten",
    "sind",
    "diesen",
    "monat",
    "zu",
    "spät",
    "der",
    "die",
    "das",
    "wie",
    "und",
  ],
};

/** Small stopword-based detector for the typed question (first-party, length-capped). */
export function detectLanguage(text: string): string {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  let best = { lang: UNKNOWN, hits: 0 };
  for (const [lang, stop] of Object.entries(STOPWORDS)) {
    const hits = words.filter((w) => stop.includes(w)).length;
    if (hits > best.hits) best = { lang, hits };
  }
  return best.lang;
}

export function intentOf(text: string) {
  return { text: text.trim().slice(0, 280), language: detectLanguage(text) };
}
