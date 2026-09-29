import { JEV_DEFAULT_BASE_URL, JEV_DEFAULT_MODEL } from "./config";
import { createEngineDecider } from "./engine";
import { type Capabilities, type Decider, isFloatingAlias, type Questions } from "./types";
import { toWireQuestion, type WireAnswer } from "./wire";

export interface SystemOneHttpConfig {
  /** Endpoint base URL, e.g. https://api.typesafe.ai or http://localhost:11435 (Ollaya). */
  baseUrl: string;
  /** Exact model id to request. Aliases are allowed but the answered version is what counts. */
  model: string;
  apiKey?: string;
  capabilities: Capabilities;
  /** Stable decider id; defaults to the model id (or `<prefix>:<model>`). */
  id?: string;
  timeoutMs?: number;
  retries?: number;
  fetch?: typeof fetch;
}

export class EngineHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EngineHttpError";
  }
}

/**
 * Decider for any endpoint speaking the System One wire format (`POST /v1/systemone`):
 * TypeSafe Jev, Ollaya, a Laya server, openjev-sglang, stuntd, ...
 */
export function createSystemOneHttpDecider(config: SystemOneHttpConfig): Decider {
  const doFetch = config.fetch ?? fetch;
  const retries = config.retries ?? 3;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const url = `${config.baseUrl.replace(/\/$/, "")}/v1/systemone`;

  return createEngineDecider({
    id: config.id ?? config.model,
    capabilities: config.capabilities,
    async call(state, questions: Questions, options) {
      const body = JSON.stringify({
        state,
        model: config.model,
        questions: Object.fromEntries(
          Object.entries(questions).map(([id, q]) => [id, toWireQuestion(q)]),
        ),
      });
      for (let attempt = 0; ; attempt++) {
        const signal = options?.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs);
        let response: Response;
        try {
          response = await doFetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body,
            signal,
          });
        } catch (error) {
          if (attempt < retries && !options?.signal?.aborted) {
            await sleep(backoff(attempt));
            continue;
          }
          throw error;
        }
        if (response.ok) {
          const json = (await response.json()) as {
            model?: string;
            answers?: Record<string, WireAnswer>;
            usage?: { input_tokens?: number };
          };
          const engineVersion =
            json.model && !isFloatingAlias(json.model) ? json.model : config.model;
          return {
            answers: json.answers ?? {},
            engineVersion,
            inputTokens: json.usage?.input_tokens ?? 0,
          };
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < retries) {
          const after = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : backoff(attempt));
          continue;
        }
        const text = await response.text().catch(() => "");
        throw new EngineHttpError(
          response.status,
          `${response.status} ${response.statusText} after ${attempt + 1} attempt(s): ${text.slice(0, 200)}`,
        );
      }
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(4000, 250 * 2 ** attempt) + Math.random() * 100;

/** Jev 1.13 (hosted). Limits from docs.typesafe.ai/models; determinism measured in spike 0.1. */
export const JEV_CAPABILITIES: Capabilities = {
  maxStateTokens: 32_000,
  maxRequestTokens: 60_000,
  maxQuestionsPerRequest: 80,
  maxChoiceOptions: 200,
  maxCriteriaTokens: 4_000,
  primitives: ["choice", "score", "noul"],
  languages: ["english"],
  modalities: ["text"],
  locality: "cloud",
  deterministic: false,
  p50LatencyMs: 280,
  costPerMTok: 0.042,
};

/** Laya-class local engines (Ollaya, in-process Laya). Conservative limits. */
export const LAYA_CLASS_CAPABILITIES: Capabilities = {
  maxStateTokens: 512,
  maxRequestTokens: 3_000,
  maxQuestionsPerRequest: 12,
  maxChoiceOptions: 19,
  maxCriteriaTokens: 192,
  primitives: ["choice", "score", "noul"],
  languages: ["english"],
  modalities: ["text"],
  locality: "local",
  deterministic: "unknown",
  p50LatencyMs: 140,
  costPerMTok: 0,
};

export function createJevDecider(config: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
}): Decider {
  return createSystemOneHttpDecider({
    baseUrl: config.baseUrl ?? JEV_DEFAULT_BASE_URL,
    model: config.model ?? JEV_DEFAULT_MODEL,
    apiKey: config.apiKey,
    capabilities: JEV_CAPABILITIES,
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });
}
