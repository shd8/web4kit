import type { ExpectedAnswer, Fixture, Invariant, SituatedFixture } from "@web4kit/conformance";
import type { ContextEnvelope } from "@web4kit/context";
import { intentOf, situationOf } from "./core";

const envelope = (role: string, device: "mobile" | "desktop" = "desktop"): ContextEnvelope => ({
  utm: {},
  languages: ["en-GB"],
  device,
  saveData: false,
  now: "2026-09-28T07:30:00Z", // Monday 09:30 in Madrid
  consent: false,
  roles: [role],
});

const ROLE_INVARIANTS: Record<string, Invariant[]> = {
  "ops-manager": [
    { type: "present", source: "late-shipments" },
    { type: "hero", sources: ["kpis", "late-shipments"] },
    { type: "absent", source: "briefing" },
  ],
  analyst: [
    { type: "present", source: "on-time-trend" },
    { type: "present", source: "supplier-status" },
  ],
  executive: [
    { type: "hero", sources: ["briefing", "kpis"] },
    { type: "absent", source: "inventory-risk" },
  ],
};

const ROLE_LABELS: Record<string, ExpectedAnswer[]> = {
  "ops-manager": [
    { kind: "A.relevance", source: "late-shipments", accept: [true] },
    { kind: "A.relevance", source: "briefing", accept: [false] },
    { kind: "A.relevance", source: "top-products", accept: [false] },
  ],
  analyst: [
    { kind: "A.relevance", source: "on-time-trend", accept: [true] },
    { kind: "A.relevance", source: "supplier-status", accept: [true] },
  ],
  executive: [
    { kind: "A.relevance", source: "briefing", accept: [true] },
    { kind: "A.relevance", source: "kpis", accept: [true] },
  ],
};

/** Typed questions with paraphrases and the sources a good analyst would (not) show. */
const QUESTIONS: Array<{ texts: string[]; show: string[]; hide: string[] }> = [
  {
    texts: [
      "Which suppliers are late this month?",
      "Who is delivering late this month?",
      "Which suppliers keep missing delivery dates?",
    ],
    show: ["supplier-status", "late-shipments"],
    hide: ["top-products", "order-volume"],
  },
  {
    texts: ["What are our best selling products?", "Which products bring in the most revenue?"],
    show: ["top-products"],
    hide: ["supply-network", "late-shipments"],
  },
  {
    texts: [
      "Show me how on-time delivery is trending by region",
      "Is delivery reliability getting worse over time?",
    ],
    show: ["on-time-trend"],
    hide: ["top-products"],
  },
  {
    texts: ["Which products are about to run out of stock?", "Where is stock cover lowest?"],
    show: ["inventory-risk"],
    hide: ["order-volume", "briefing"],
  },
  {
    texts: [
      "How is order volume compared to last year?",
      "Are we getting more orders than last year?",
    ],
    show: ["order-volume"],
    hide: ["inventory-risk"],
  },
  {
    texts: ["Show me the supply network", "How are suppliers connected to our warehouses?"],
    show: ["supply-network"],
    hide: ["top-products"],
  },
  {
    texts: ["Which shipments are delayed right now?", "What shipments are stuck today?"],
    show: ["late-shipments"],
    hide: ["margins", "order-volume"],
  },
  {
    texts: ["What is our margin per supplier?", "Which suppliers are most profitable for us?"],
    show: ["margins"],
    hide: ["late-shipments"],
  },
];

export const CORE_FIXTURES: Fixture[] = [
  {
    name: "ops-manager-monday",
    title: "Ops manager · Monday 09:30",
    envelope: envelope("ops-manager"),
    invariants: ROLE_INVARIANTS["ops-manager"]!,
  },
  {
    name: "analyst-desktop",
    title: "Analyst · desktop",
    envelope: envelope("analyst"),
    invariants: ROLE_INVARIANTS.analyst!,
  },
  {
    name: "executive-mobile",
    title: "Executive · on the phone",
    envelope: envelope("executive", "mobile"),
    invariants: ROLE_INVARIANTS.executive!,
  },
  {
    name: "analyst-late-suppliers",
    title: "Analyst asks: which suppliers are late?",
    envelope: envelope("analyst"),
    intent: intentOf("Which suppliers are late this month?"),
    invariants: [],
  },
  {
    name: "analyst-spanish-question",
    title: "Analyst asks in Spanish",
    envelope: { ...envelope("analyst"), languages: ["es-ES"] },
    intent: intentOf("¿Qué proveedores llegan tarde este mes?"),
    invariants: ROLE_INVARIANTS.analyst!,
  },
];

export function suiteFixtures(_limit?: number): SituatedFixture[] {
  const fixtures: Fixture[] = [];
  for (const role of ["ops-manager", "analyst", "executive"]) {
    for (const device of ["desktop", "mobile"] as const) {
      fixtures.push({
        name: `role=${role},device=${device}`,
        envelope: envelope(role, device),
        invariants: ROLE_INVARIANTS[role]!,
        expected: ROLE_LABELS[role]!,
      });
      for (const [qi, q] of QUESTIONS.entries()) {
        for (const [ti, text] of q.texts.entries()) {
          fixtures.push({
            name: `role=${role},device=${device},q=${qi}.${ti}`,
            envelope: envelope(role, device),
            intent: intentOf(text),
            invariants: [],
            expected: [
              ...q.show.map((source) => ({ kind: "A.relevance", source, accept: [true] })),
              ...q.hide.map((source) => ({ kind: "A.relevance", source, accept: [false] })),
            ],
          });
        }
      }
    }
  }
  return [...CORE_FIXTURES, ...fixtures].map((f) => ({ ...f, situation: situationOf(f.envelope) }));
}
