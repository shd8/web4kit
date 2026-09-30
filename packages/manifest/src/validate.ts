import { stableHash } from "@web4kit/ir";
import { describeAudience, QUESTION_TEMPLATE_VERSION } from "./authoring";
import {
  type ComponentManifest,
  type ComponentManifestInput,
  ComponentManifestSchema,
  type DataSourceManifest,
  type DataSourceManifestInput,
  DataSourceManifestSchema,
  LIMITS,
  type ManifestSet,
} from "./schema";

export class ManifestError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid manifests:\n  - ${issues.join("\n  - ")}`);
    this.name = "ManifestError";
  }
}

/**
 * Validate data source and component manifests, check cross references, and compute the
 * manifest set version from content. Errors name the source/component and the field.
 */
export function defineManifests(input: {
  site: string;
  sources: DataSourceManifestInput[];
  components: ComponentManifestInput[];
}): ManifestSet {
  const issues: string[] = [];
  const sources: DataSourceManifest[] = [];
  const components: ComponentManifest[] = [];

  for (const raw of input.components) {
    const r = ComponentManifestSchema.safeParse(raw);
    if (r.success) components.push(r.data);
    else
      for (const i of r.error.issues)
        issues.push(`component ${idOf(raw)}: ${fieldOf(i.path)} ${i.message}`);
  }
  for (const raw of input.sources) {
    const r = DataSourceManifestSchema.safeParse(raw);
    if (r.success) sources.push(r.data);
    else
      for (const i of r.error.issues)
        issues.push(`source ${idOf(raw)}: ${fieldOf(i.path)} ${i.message}`);
  }

  const componentIds = new Set(components.map((c) => c.id));
  for (const id of duplicates(sources.map((s) => s.id))) issues.push(`source ${id}: duplicate id`);
  for (const id of duplicates(components.map((c) => c.id)))
    issues.push(`component ${id}: duplicate id`);
  for (const c of components) {
    if (c.mediaHeavy && !c.fallback)
      issues.push(`component ${c.id}: fallback required for media-heavy components`);
    if (c.fallback && !componentIds.has(c.fallback))
      issues.push(`component ${c.id}: fallback ${c.fallback} not found`);
  }
  for (const s of sources) {
    const compatible = compatibleComponents(s, components).map((c) => c.id);
    if (compatible.length === 0)
      issues.push(`source ${s.id}: no compatible component for shape ${s.shape}`);
    const refs = [s.default.component, ...s.heuristics.map((h) => h.component)].filter(
      Boolean,
    ) as string[];
    for (const ref of refs) {
      if (!compatible.includes(ref))
        issues.push(`source ${s.id}: component ${ref} is not compatible`);
    }
    if (s.audience) {
      const text = describeAudience(s.audience);
      if (text.length > LIMITS.audience)
        issues.push(
          `source ${s.id}: audience renders to ${text.length} characters (allowed ${LIMITS.audience})`,
        );
    }
    if (s.mustInclude && s.mustExclude && sameCondition(s.mustInclude, s.mustExclude))
      issues.push(`source ${s.id}: mustInclude and mustExclude are identical`);
  }
  if (issues.length > 0) throw new ManifestError(issues);

  return {
    site: input.site,
    version: manifestVersion(input.site, sources, components),
    deciderVersion: deciderVersion(input.site, sources, components),
    sources,
    components,
  };
}

/** Components whose accepted shapes and required roles match the source. */
export function compatibleComponents(source: DataSourceManifest, components: ComponentManifest[]) {
  return components
    .map((c) => ({
      c,
      accept: c.accepts.find(
        (a) => a.shape === source.shape && a.requires.every((r) => r in source.fields),
      ),
    }))
    .filter((x) => x.accept)
    .sort((a, b) => a.accept!.rank - b.accept!.rank || a.c.id.localeCompare(b.c.id))
    .map((x) => x.c);
}

/** Content-derived version; changes whenever any manifest changes. */
export function manifestVersion(
  site: string,
  sources: DataSourceManifest[],
  components: ComponentManifest[],
) {
  const content = JSON.stringify({ site, sources, components }, (key, value) =>
    key === "fetch" ? undefined : value,
  );
  return `man-${stableHash(content, 12)}`;
}

/**
 * Version of what a decider can observe: the question surface. Cosmetic fields (label,
 * eyebrow), rules-only fields (heuristics, defaults, invariants), trust, access and fetch are
 * excluded, so editing them keeps calibration profiles valid.
 */
export function deciderVersion(
  site: string,
  sources: DataSourceManifest[],
  components: ComponentManifest[],
) {
  const surface = {
    site,
    template: QUESTION_TEMPLATE_VERSION,
    sources: sources.map((s) => ({
      id: s.id,
      shape: s.shape,
      what: s.what,
      not_for: s.not_for ?? null,
      tags: s.tags,
      audience: s.audience ? describeAudience(s.audience) : null,
      roles: Object.keys(s.fields).sort(),
    })),
    components: components.map((c) => ({
      id: c.id,
      what: c.what,
      category: c.category ?? null,
      accepts: c.accepts,
    })),
  };
  return `dec-${stableHash(JSON.stringify(surface), 12)}`;
}

function sameCondition(a: Record<string, string[]>, b: Record<string, string[]>) {
  const norm = (c: Record<string, string[]>) =>
    JSON.stringify(
      Object.entries(c)
        .map(([k, v]) => [k, [...v].sort()])
        .sort(([x], [y]) => String(x).localeCompare(String(y))),
    );
  return norm(a) === norm(b);
}

function idOf(raw: unknown): string {
  const id = (raw as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "<no id>";
}
function fieldOf(path: PropertyKey[]): string {
  return path.length ? `${path.map(String).join(".")}:` : "";
}
function duplicates(ids: string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}
