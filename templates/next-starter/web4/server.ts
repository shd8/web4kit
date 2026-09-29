import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ContextEnvelope,
  collectEnvelope,
  type RequestLike,
  resolveContext,
} from "@web4kit/context";
import { createJevDecider, type Decider, jevConfigFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import {
  type CalibrationProfile,
  CalibrationProfileSchema,
  createPlanner,
  LruPlanCache,
  type PlanResult,
} from "@web4kit/planner";
import { type PlanData, resolvePlanData } from "@web4kit/react";
import { PERSONAS } from "./fixtures";
import { BOOKINGS } from "./hotel";
import { manifests } from "./manifests";
import { situationOf } from "./situation";

loadDotEnv(resolve(process.cwd(), ".env"));

const jevConfig = jevConfigFromEnv();
const decider: Decider | undefined = jevConfig ? createJevDecider(jevConfig) : undefined;

function loadCalibration(engineId: string): CalibrationProfile | undefined {
  const file = resolve(process.cwd(), "calibration", `${engineId}.json`);
  if (!existsSync(file)) return undefined;
  const profile = CalibrationProfileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  // A profile measured against other manifests would gate with the wrong thresholds.
  return profile.manifestVersion === manifests.version ? profile : undefined;
}

const calibration = decider ? loadCalibration(decider.id) : undefined;
const planner = createPlanner({
  manifests,
  cache: new LruPlanCache(1000),
  ...(decider ? { decider } : {}),
  ...(calibration ? { calibration } : {}),
});

/** Running totals for the /stats page (per server process). */
export const stats = {
  startedAt: new Date().toISOString(),
  engine: planner.engineId,
  calibration:
    calibration?.version ?? (decider ? "missing: every answer falls back to rules" : "rules"),
  costPerMTok: decider?.capabilities.costPerMTok ?? 0,
  pages: 0,
  cacheHits: 0,
  deciderRequests: 0,
  inputTokens: 0,
  planningMsTotal: 0,
  situations: new Map<string, number>(),
};

export interface PageResult extends PlanResult {
  data: PlanData;
  persona?: string;
}

/**
 * Plan and resolve one page for a request. In development, `?as=<persona>` previews a persona
 * (lab-style override); in production only real request signals are used.
 */
export async function pageFor(request: RequestLike): Promise<PageResult> {
  const url = new URL(request.url, "http://localhost");
  const dev = process.env.NODE_ENV !== "production";
  const personaName = dev ? (url.searchParams.get("as") ?? undefined) : undefined;
  const persona = personaName ? PERSONAS.find((p) => p.name === personaName) : undefined;

  let envelope: ContextEnvelope =
    persona?.envelope ?? resolveContext(request, { labMode: false }).envelope;
  // First-party facts the hotel already knows: booking dates from a confirmation-email link.
  const code = url.searchParams.get("booking");
  const booked = code ? BOOKINGS[code] : undefined;
  if (booked && !persona)
    envelope = {
      ...envelope,
      firstParty: { arrival: booked.arrival, nights: String(booked.nights) },
    };

  const situation = situationOf(envelope);
  const result = await planner.plan({ situation });
  const data = await resolvePlanData(result.plan, manifests, {
    now: new Date(envelope.now),
    viewer: { roles: [] },
    ...(envelope.geo ? { visitorGeo: { lat: envelope.geo.lat, lng: envelope.geo.lng } } : {}),
  });

  stats.pages++;
  if (result.cacheHit) stats.cacheHits++;
  stats.deciderRequests += result.usage.requests;
  stats.inputTokens += result.usage.inputTokens;
  stats.planningMsTotal += result.planningMs;
  stats.situations.set(
    result.plan.situationHash,
    (stats.situations.get(result.plan.situationHash) ?? 0) + 1,
  );

  return { ...result, data, ...(persona ? { persona: persona.name } : {}) };
}

export { collectEnvelope, manifests };
