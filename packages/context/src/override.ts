import {
  type CollectOptions,
  type CollectResult,
  type ContextEnvelope,
  collectEnvelope,
  type RequestLike,
} from "./envelope";

export const FIXTURE_PARAM = "w4_ctx";

export interface ResolveOptions extends CollectOptions {
  /** Lab mode enables fixture overrides. Outside lab mode they are ignored. */
  labMode: boolean;
  fixtures?: Record<string, ContextEnvelope>;
  /** An envelope set directly by the lab UI (lab mode only). */
  labEnvelope?: ContextEnvelope;
  /**
   * Adds first-party facts (plain strings in `firstParty`) the site knows from its own systems.
   * Applied to real requests only, never to lab envelopes or fixtures.
   */
  enrich?: (envelope: ContextEnvelope, request: RequestLike) => ContextEnvelope;
}

export interface ResolvedContext extends CollectResult {
  source: "request" | "fixture" | "lab";
  fixture?: string;
}

export function resolveContext(request: RequestLike, options: ResolveOptions): ResolvedContext {
  if (options.labMode) {
    if (options.labEnvelope) return { envelope: options.labEnvelope, source: "lab" };
    const name = new URL(request.url, "http://localhost").searchParams.get(FIXTURE_PARAM);
    const fixture = name ? options.fixtures?.[name] : undefined;
    if (name && fixture) return { envelope: fixture, source: "fixture", fixture: name };
  }
  const collected = collectEnvelope(request, options);
  const envelope = options.enrich
    ? options.enrich(collected.envelope, request)
    : collected.envelope;
  return { ...collected, envelope, source: "request" };
}

export function isLabMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.W4_LAB_MODE === "1" || env.W4_LAB_MODE === "true";
}
