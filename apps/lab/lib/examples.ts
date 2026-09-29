import type { Fixture } from "@web4/conformance";
import type { ContextEnvelope, Situation } from "@web4/context";
import {
  CORE_FIXTURES as EXPLORER_FIXTURES,
  manifests as explorerManifests,
  situationOf as explorerSituation,
} from "@web4/example-db-explorer";
import {
  CORE_FIXTURES as RESTAURANT_FIXTURES,
  manifests as restaurantManifests,
  situationOf as restaurantSituation,
  VENUE,
} from "@web4/example-restaurant";
import type { ManifestSet } from "@web4/manifest";

/** Client-safe description of a lab example (no server-only modules). */
export interface LabExample {
  id: "restaurant" | "db-explorer";
  name: string;
  tagline: string;
  theme: "lumbre" | "ops";
  manifests: ManifestSet;
  fixtures: Fixture[];
  situationOf: (envelope: ContextEnvelope) => Situation;
  venue?: { lat: number; lng: number; timezone: string };
}

export const EXAMPLES: Record<LabExample["id"], LabExample> = {
  restaurant: {
    id: "restaurant",
    name: "Casa Lumbre",
    tagline: "Fire-grill restaurant · Lavapiés, Madrid",
    theme: "lumbre",
    manifests: restaurantManifests,
    fixtures: RESTAURANT_FIXTURES,
    situationOf: restaurantSituation,
    venue: { ...VENUE.location, timezone: VENUE.timezone },
  },
  "db-explorer": {
    id: "db-explorer",
    name: "Meridian Supply",
    tagline: "Operations explorer over a supplier graph",
    theme: "ops",
    manifests: explorerManifests,
    fixtures: EXPLORER_FIXTURES,
    situationOf: explorerSituation,
  },
};

export function isExampleId(id: string): id is LabExample["id"] {
  return id in EXAMPLES;
}

export type EngineChoice = "rules" | "local" | "jev" | "cascade";

export interface EngineInfo {
  id: EngineChoice;
  label: string;
  available: boolean;
  detail: string;
}

/** Response of POST /api/plan. */
export interface PlanResponse {
  plan: import("@web4/ir").Plan;
  cacheHit: boolean;
  planningMs: number;
  usage: { requests: number; inputTokens: number };
  engine: EngineChoice;
  engineId: string;
  situation: Situation;
  calibration: string;
}
