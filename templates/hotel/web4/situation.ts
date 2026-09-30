import {
  CORE_BUCKETS,
  CORE_RULES,
  type ContextEnvelope,
  DAY_PART_BUCKET,
  dayPartRule,
  deriveSituation,
  distanceRule,
  type SituationRule,
} from "@web4kit/context";
import { daysBetween, forecastFor, HOTEL } from "./hotel";

/**
 * Situation rules turn the request into English labels. All arithmetic happens here:
 * System One models only ever see the labels.
 */
export const BUCKETS = {
  ...CORE_BUCKETS,
  ...DAY_PART_BUCKET,
  stayPhase: ["researching", "upcoming", "arriving-today", "in-house", "checked-out"],
  weather: ["sunny", "mild", "rainy"],
  visitor: ["nearby", "local", "tourist"],
} as const;

/** Stay phase from the booking dates the site resolved itself (envelope.firstParty). */
const stayPhaseRule: SituationRule = (env) => {
  const arrival = env.firstParty?.arrival;
  const nights = Number(env.firstParty?.nights ?? "0");
  if (!arrival) return { stayPhase: "researching" };
  const until = daysBetween(new Date(env.now), arrival); // days until arrival
  if (until > 0) return { stayPhase: "upcoming" };
  if (until === 0) return { stayPhase: "arriving-today" };
  return { stayPhase: -until < nights ? "in-house" : "checked-out" };
};

const weatherRule: SituationRule = (env) => ({ weather: forecastFor(new Date(env.now)).sky });

export const RULES: SituationRule[] = [
  ...CORE_RULES,
  stayPhaseRule,
  dayPartRule({ timezone: HOTEL.timezone }),
  weatherRule,
  distanceRule({ location: HOTEL.location, localKm: 60 }),
];

export function situationOf(envelope: ContextEnvelope) {
  return deriveSituation(envelope, RULES);
}
