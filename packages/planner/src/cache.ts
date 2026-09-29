import { type Plan, stableHash } from "@web4/ir";

export interface PlanCache {
  get(key: string): Plan | undefined;
  set(key: string, plan: Plan): void;
}

export interface PlanCacheKey {
  site: string;
  situationHash: string;
  manifestVersion: string;
  engineId: string;
  calibrationVersion: string;
  /** Hash of the first-party intent, when one is part of the decision. */
  intentHash?: string;
}

export function planCacheKey(key: PlanCacheKey): string {
  const parts = [
    key.site,
    key.situationHash,
    key.manifestVersion,
    key.engineId,
    key.calibrationVersion,
    key.intentHash ?? "",
  ];
  return stableHash(parts.join("\u0000"), 24);
}

/** In-memory LRU plan cache (design D10). Plans hold no user data, so they are shared. */
export class LruPlanCache implements PlanCache {
  private readonly entries = new Map<string, Plan>();
  constructor(private readonly max = 500) {}

  get(key: string): Plan | undefined {
    const plan = this.entries.get(key);
    if (plan) {
      this.entries.delete(key);
      this.entries.set(key, plan);
    }
    return plan;
  }

  set(key: string, plan: Plan): void {
    this.entries.delete(key);
    this.entries.set(key, plan);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size() {
    return this.entries.size;
  }
}
