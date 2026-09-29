import { existsSync } from "node:fs";

export const JEV_DEFAULT_BASE_URL = "https://api.typesafe.ai";
/** Pinned Jev version (never an alias; see design D2). */
export const JEV_DEFAULT_MODEL = "jev-1.13.0";

export interface JevConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Load a .env file into process.env if it exists. Existing variables are not overwritten.
 * Uses Node's built-in loader, so no dependency is needed.
 */
export function loadDotEnv(path = ".env"): boolean {
  if (!existsSync(path)) return false;
  process.loadEnvFile(path);
  return true;
}

/**
 * Resolve the Jev engine configuration. The key is read from JEV_API_KEY and passed explicitly
 * to the engine; TYPESAFE_API_KEY is deliberately not consulted.
 */
export function jevConfigFromEnv(env: NodeJS.ProcessEnv = process.env): JevConfig | undefined {
  const apiKey = env.JEV_API_KEY?.trim();
  if (!apiKey) return undefined;
  return {
    apiKey,
    baseUrl: env.JEV_BASE_URL?.trim() || JEV_DEFAULT_BASE_URL,
    model: env.JEV_MODEL?.trim() || JEV_DEFAULT_MODEL,
  };
}

/** Base URL of a local System One endpoint (e.g. Ollaya), if configured. */
export function localEngineUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.W4_LOCAL_ENGINE_URL?.trim() || undefined;
}

/** Model served by the local System One endpoint (Ollaya model name). */
export function localEngineModelFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.W4_LOCAL_ENGINE_MODEL?.trim() || "laya:en";
}
