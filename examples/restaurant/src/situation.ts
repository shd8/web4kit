import {
  CORE_BUCKETS,
  CORE_RULES,
  type ContextEnvelope,
  deriveSituation,
  VENUE_BUCKETS,
  venueRules,
} from "@web4/context";
import { venueConfig } from "./venue";

export const RULES = [...CORE_RULES, ...venueRules(venueConfig)];
export const BUCKETS = { ...CORE_BUCKETS, ...VENUE_BUCKETS };

export function situationOf(envelope: ContextEnvelope) {
  return deriveSituation(envelope, RULES);
}
