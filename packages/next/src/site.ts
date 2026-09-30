import {
  type CollectOptions,
  type ContextEnvelope,
  deriveSituation,
  type RequestLike,
  resolveContext,
  type Situation,
  type SituationRule,
} from "@web4kit/context";
import type { Decider } from "@web4kit/decider";
import type { ManifestSet } from "@web4kit/manifest";
import {
  type CalibrationProfile,
  createPlanner,
  LruPlanCache,
  type PlanCache,
  type PlanEvent,
  type Planner,
  type PlannerStats,
  type PlanResult,
} from "@web4kit/planner";
import { type PlanData, resolvePlanData } from "@web4kit/react";

/** A named envelope a developer can preview with `?as=<name>` (fixtures qualify). */
export interface Persona {
  name: string;
  title?: string;
  envelope: ContextEnvelope;
}

export interface SiteConfig {
  manifests: ManifestSet;
  /** Situation rules, or a function from envelope to situation. */
  situation: SituationRule[] | ((envelope: ContextEnvelope) => Situation);
  /** A ready planner. When omitted one is created from decider / calibration / cache. */
  planner?: Planner;
  /** System One engine; the page is planned with manifest rules when omitted. */
  decider?: Decider;
  calibration?: CalibrationProfile;
  /** Plan cache; defaults to an in-memory LRU of 1000 plans. `false` disables caching. */
  cache?: PlanCache | false;
  onPlan?: (event: PlanEvent) => void;
  /** Personas for development previews. */
  personas?: Persona[];
  /** Whether `?as=` previews are honoured. Defaults to on outside production only. */
  previews?: boolean;
  /** Query parameter naming a persona. Default `as`. */
  previewParam?: string;
  /**
   * First-party facts for real requests (e.g. booking dates resolved from a link). Never
   * called for personas.
   */
  enrich?: (
    envelope: ContextEnvelope,
    request: RequestLike,
  ) => ContextEnvelope | Promise<ContextEnvelope>;
  /** Roles of the viewer for access-controlled sources. Default: anonymous. */
  viewer?: (request: RequestLike) => { roles: string[] } | Promise<{ roles: string[] }>;
  /** Envelope collection options (e.g. a geo lookup). */
  collect?: Omit<CollectOptions, "now">;
}

export interface SitePage extends PlanResult {
  data: PlanData;
  situation: Situation;
  envelope: ContextEnvelope;
  /** Set when the page previews a persona. */
  persona?: string;
  /** Set-Cookie value for consented visit memory (real requests only). */
  setCookie?: string;
}

export type SiteStats = PlannerStats;

export interface Site {
  readonly manifests: ManifestSet;
  readonly planner: Planner;
  readonly personas: readonly Persona[];
  readonly previews: boolean;
  readonly previewParam: string;
  /** Framework-agnostic entry: plan and resolve the page for one request. */
  handle(request: RequestLike, options?: { now?: Date }): Promise<SitePage>;
  stats(): SiteStats;
}

const isProduction = () => typeof process !== "undefined" && process.env?.NODE_ENV === "production";

export function createSiteCore(config: SiteConfig): Site {
  const planner =
    config.planner ??
    createPlanner({
      manifests: config.manifests,
      ...(config.decider ? { decider: config.decider } : {}),
      ...(config.calibration ? { calibration: config.calibration } : {}),
      ...(config.cache === false ? {} : { cache: config.cache ?? new LruPlanCache(1000) }),
      ...(config.onPlan ? { onPlan: config.onPlan } : {}),
    });
  const situationOf =
    typeof config.situation === "function"
      ? config.situation
      : (e: ContextEnvelope) => deriveSituation(e, config.situation as SituationRule[]);
  const personas = config.personas ?? [];
  const previews = config.previews ?? !isProduction();
  const previewParam = config.previewParam ?? "as";

  return {
    manifests: config.manifests,
    planner,
    personas,
    previews,
    previewParam,
    stats: () => planner.stats(),
    async handle(request, options = {}) {
      // 1. Persona preview (development only).
      const url = new URL(request.url, "http://localhost");
      const name = previews ? url.searchParams.get(previewParam) : null;
      const persona = name ? personas.find((p) => p.name === name) : undefined;

      // 2-3. Context from the real request, then first-party enrichment (never for personas).
      let envelope: ContextEnvelope;
      let setCookie: string | undefined;
      if (persona) {
        envelope = persona.envelope;
      } else {
        const resolved = resolveContext(request, {
          labMode: false,
          ...config.collect,
          ...(options.now ? { now: options.now } : {}),
        });
        envelope = config.enrich
          ? await config.enrich(resolved.envelope, request)
          : resolved.envelope;
        setCookie = resolved.setCookie;
      }

      // 4-5. Situation labels, then one planning round (or a cache hit).
      const situation = situationOf(envelope);
      const result = await planner.plan({ situation });

      // 6. Render-time data with the planned situation.
      const viewer = (await config.viewer?.(request)) ?? { roles: [] };
      const data = await resolvePlanData(result.plan, config.manifests, {
        now: new Date(envelope.now),
        viewer,
        situation,
        ...(envelope.timezone ? { timezone: envelope.timezone } : {}),
        ...(envelope.languages[0] ? { locale: envelope.languages[0] } : {}),
        ...(situation.language ? { language: situation.language } : {}),
        ...(envelope.geo ? { visitorGeo: { lat: envelope.geo.lat, lng: envelope.geo.lng } } : {}),
      });

      return {
        ...result,
        data,
        situation,
        envelope,
        ...(persona ? { persona: persona.name } : {}),
        ...(setCookie ? { setCookie } : {}),
      };
    },
  };
}
