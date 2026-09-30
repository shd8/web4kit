import { loadDotEnv } from "@web4kit/decider/node";
import "server-only";
import { resolve } from "node:path";
import type { ContextEnvelope } from "@web4kit/context";
import {
  createCascadeDecider,
  type Decider,
  isReachable,
  localEngineUrlFromEnv,
  remoteEnginesFromEnv,
} from "@web4kit/decider";
import type { Plan } from "@web4kit/ir";
import {
  acceptThreshold,
  createPlanner,
  type Intent,
  LruPlanCache,
  type Planner,
} from "@web4kit/planner";
import { loadCalibration as loadStoredCalibration } from "@web4kit/planner/node";
import { type PlanData, resolvePlanData } from "@web4kit/react";
import {
  type EngineChoice,
  type EngineInfo,
  EXAMPLES,
  type LabExample,
  type PlanResponse,
} from "./examples";

const ROOT = resolve(process.cwd(), "../..");
loadDotEnv(resolve(ROOT, ".env"));

export const LAB_MODE = process.env.W4_LAB_MODE === "1" || process.env.W4_LAB_MODE === "true";

const remote = remoteEnginesFromEnv();
const cache = new LruPlanCache(2000);
const planners = new Map<string, Planner>();
let localReachable: boolean | undefined;

const loadCalibration = (site: string, engineId: string) =>
  loadStoredCalibration(resolve(ROOT, "calibration", site), engineId);

async function localAvailable(): Promise<boolean> {
  const url = localEngineUrlFromEnv();
  if (!remote.local || !url) return false;
  localReachable ??= await isReachable(url);
  return localReachable;
}

export async function engines(): Promise<EngineInfo[]> {
  const local = await localAvailable();
  return [
    {
      id: "rules",
      label: "Rules",
      available: true,
      detail: "Manifest heuristics · deterministic · offline",
    },
    {
      id: "local",
      label: "Local",
      available: local,
      detail: local
        ? `${remote.local!.id} via ${localEngineUrlFromEnv()}`
        : "No local System One endpoint (W4_LOCAL_ENGINE_URL)",
    },
    {
      id: "jev",
      label: "Jev",
      available: !!remote.jev,
      detail: remote.jev ? `${remote.jev.id} · hosted` : "JEV_API_KEY not set",
    },
    {
      id: "cascade",
      label: "Cascade",
      available: local && !!remote.jev,
      detail: "Local first, escalate low-confidence answers to Jev",
    },
  ];
}

async function deciderFor(choice: EngineChoice, example: LabExample): Promise<Decider | undefined> {
  if (choice === "jev") return remote.jev;
  if (choice === "local") return (await localAvailable()) ? remote.local : undefined;
  if (choice === "cascade" && remote.jev && (await localAvailable())) {
    const profile = loadCalibration(example.manifests.site, remote.local!.id);
    return createCascadeDecider({
      cheap: remote.local!,
      strong: remote.jev,
      threshold: (q) => (q.meta ? acceptThreshold(profile, q.meta.kind, "english") : undefined),
    });
  }
  return undefined; // rules
}

async function plannerFor(
  example: LabExample,
  choice: EngineChoice,
): Promise<{ planner: Planner; calibration: string }> {
  const decider = await deciderFor(choice, example);
  const key = `${example.id}:${decider?.id ?? "rules"}`;
  const profile = decider
    ? loadCalibration(
        example.manifests.site,
        decider.id.startsWith("cascade") ? remote.jev!.id : decider.id,
      )
    : undefined;
  let planner = planners.get(key);
  if (!planner) {
    planner = createPlanner({
      manifests: example.manifests,
      cache,
      ...(decider ? { decider } : {}),
      ...(profile ? { calibration: profile } : {}),
    });
    planners.set(key, planner);
  }
  const status = planner.calibrationStatus;
  return {
    planner,
    calibration: !decider
      ? "rules"
      : status.status === "active"
        ? status.version
        : status.status === "stale"
          ? `stale ${status.version} (re-run conformance) → rules`
          : "none (uncalibrated → rules)",
  };
}

export async function planFor(
  exampleId: LabExample["id"],
  envelope: ContextEnvelope,
  choice: EngineChoice,
  intent?: Intent,
): Promise<PlanResponse> {
  const example = EXAMPLES[exampleId];
  const { planner, calibration } = await plannerFor(example, choice);
  const situation = example.situationOf(envelope);
  const result = await planner.plan({ situation, ...(intent?.text ? { intent } : {}) });
  const engine: EngineChoice = planner.engineId === "rules" ? "rules" : choice;
  return { ...result, engine, engineId: planner.engineId, situation, calibration };
}

export async function dataFor(
  exampleId: LabExample["id"],
  plan: Plan,
  envelope: ContextEnvelope,
  roles: string[] = [],
): Promise<PlanData> {
  const example = EXAMPLES[exampleId];
  const situation = example.situationOf(envelope);
  return resolvePlanData(plan, example.manifests, {
    now: new Date(envelope.now),
    viewer: { roles: envelope.roles ?? roles },
    situation,
    ...(envelope.geo ? { visitorGeo: { lat: envelope.geo.lat, lng: envelope.geo.lng } } : {}),
    language: situation.language ?? "english",
  });
}
