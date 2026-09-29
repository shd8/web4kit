import { jevConfigFromEnv, localEngineModelFromEnv, localEngineUrlFromEnv } from "./config";
import { createJevDecider, createSystemOneHttpDecider, LAYA_CLASS_CAPABILITIES } from "./http";
import type { Decider } from "./types";

export interface RemoteEngines {
  jev?: Decider;
  local?: Decider;
}

/** Engines configured through the environment (design D11). Rules are provided by the planner. */
export function remoteEnginesFromEnv(env: NodeJS.ProcessEnv = process.env): RemoteEngines {
  const engines: RemoteEngines = {};
  const jev = jevConfigFromEnv(env);
  if (jev) engines.jev = createJevDecider(jev);
  const localUrl = localEngineUrlFromEnv(env);
  if (localUrl) {
    const model = localEngineModelFromEnv(env);
    engines.local = createSystemOneHttpDecider({
      id: `ollaya:${model}`,
      baseUrl: localUrl,
      model,
      // Laya (fp32 encoder) answers byte-identically on repeated calls (measured 2026-09-30).
      capabilities: {
        ...LAYA_CLASS_CAPABILITIES,
        deterministic: model.startsWith("laya") ? true : "unknown",
      },
      timeoutMs: Number(env.W4_LOCAL_ENGINE_TIMEOUT_MS) || 20_000,
      retries: 1,
    });
  }
  return engines;
}

/** True when a System One endpoint answers on /v1/models. */
export async function isReachable(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return r.ok;
  } catch {
    return false;
  }
}
