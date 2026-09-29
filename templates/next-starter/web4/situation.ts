import {
  CORE_BUCKETS,
  CORE_RULES,
  type ContextEnvelope,
  deriveSituation,
  distanceKm,
  type SituationRule,
  UNKNOWN,
} from "@web4kit/context";
import { daysBetween, forecastFor, HOTEL, hotelClock } from "./hotel";

/**
 * Situation rules turn the request into English labels. All arithmetic happens here:
 * System One models only ever see the labels.
 */
export const BUCKETS = {
  ...CORE_BUCKETS,
  stayPhase: ["researching", "upcoming", "arriving-today", "in-house", "checked-out"],
  dayPart: ["morning", "afternoon", "evening", "night"],
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

const dayPartRule: SituationRule = (env) => {
  const { minutes } = hotelClock(new Date(env.now));
  const h = minutes / 60;
  return {
    dayPart:
      h >= 6 && h < 12
        ? "morning"
        : h >= 12 && h < 18
          ? "afternoon"
          : h >= 18 && h < 23
            ? "evening"
            : "night",
  };
};

const weatherRule: SituationRule = (env) => ({ weather: forecastFor(new Date(env.now)).sky });

const visitorRule: SituationRule = (env) => {
  if (!env.geo) return { visitor: UNKNOWN };
  const km = distanceKm(env.geo, HOTEL.location);
  return { visitor: km < 3 ? "nearby" : km < 60 ? "local" : "tourist" };
};

export const RULES: SituationRule[] = [
  ...CORE_RULES,
  stayPhaseRule,
  dayPartRule,
  weatherRule,
  visitorRule,
];

export function situationOf(envelope: ContextEnvelope) {
  return deriveSituation(envelope, RULES);
}
