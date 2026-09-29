import { allBlocks, type Plan } from "@web4/ir";
import type { Access, FetchContext, ManifestSet } from "@web4/manifest";

export type SourceData =
  | { status: "ok"; data: unknown }
  | { status: "error"; error: string }
  | { status: "unauthorized" };

export type PlanData = Record<string, SourceData>;

export function canAccess(access: Access, roles: string[]): boolean {
  return access === "public" || access.roles.some((r) => roles.includes(r));
}

/**
 * Resolve every source referenced by a plan at render time (spec: plan-rendering).
 * Sources the viewer may not access are neither fetched nor rendered.
 */
export async function resolvePlanData(
  plan: Plan,
  manifests: ManifestSet,
  ctx: FetchContext,
): Promise<PlanData> {
  const byId = new Map(manifests.sources.map((s) => [s.id, s]));
  const ids = [...new Set(allBlocks(plan).map((b) => b.sourceId))];
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, SourceData]> => {
      const source = byId.get(id);
      if (!source) return [id, { status: "error", error: `unknown source ${id}` }];
      if (!canAccess(source.access, ctx.viewer.roles)) return [id, { status: "unauthorized" }];
      try {
        return [id, { status: "ok", data: await source.fetch(ctx) }];
      } catch (e) {
        return [id, { status: "error", error: e instanceof Error ? e.message : String(e) }];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** Read a dotted path from an object ("a.b.0.c"). */
export function readPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Map a record through a role -> path binding. */
export function bindRecord(
  record: unknown,
  binding: Record<string, string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(binding).map(([role, path]) => [role, readPath(record, path)]),
  );
}

/** Map a list of records through a role -> path binding. */
export function bindList(
  data: unknown,
  binding: Record<string, string>,
): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) return [];
  return data.map((item) => bindRecord(item, binding));
}
