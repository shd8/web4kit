import { type Block, type Device, type Plan, type Region, validatePlan } from "@web4kit/ir";
import { compatibleComponents, type ManifestSet } from "@web4kit/manifest";
import type { ReactElement } from "react";
import type { PlanData } from "./data";
import { cx } from "./primitives";
import type { BlockContext, Registry } from "./registry";

export interface RenderedBlock {
  sourceId: string;
  /** Component actually rendered, or null when the block was omitted. */
  componentId: string | null;
  fallback?: string;
}

export interface PlanViewProps {
  plan: Plan;
  data: PlanData;
  manifests: ManifestSet;
  registry: Registry;
  /** Receives what was rendered per block (fallbacks, omissions), e.g. for the Why panel. */
  onRendered?: (blocks: RenderedBlock[]) => void;
}

/**
 * Deterministic, fail-soft renderer (spec: plan-rendering). Each block is validated and rendered
 * independently; a failing block falls back to its source's default component, then is omitted.
 */
export function PlanView({ plan: input, data, manifests, registry, onRendered }: PlanViewProps) {
  const plan = validatePlan(input);
  const hasAside = plan.device === "desktop" && plan.layout.aside.length > 0;
  const report: RenderedBlock[] = [];
  const render = (block: Block, region: Region) => {
    const { element, rendered } = renderBlock(
      block,
      region,
      hasAside,
      plan.device,
      data,
      manifests,
      registry,
    );
    report.push(rendered);
    return element;
  };

  const hero = plan.layout.hero.map((b) => render(b, "hero")).filter(Boolean);
  const primary = plan.layout.primary.map((b) => render(b, "primary")).filter(Boolean);
  const aside = plan.layout.aside.map((b) => render(b, "aside")).filter(Boolean);
  const secondary = plan.layout.secondary.map((b) => render(b, "secondary")).filter(Boolean);
  const footer = plan.layout.footer.map((b) => render(b, "footer")).filter(Boolean);
  onRendered?.(report);

  return (
    <div
      className="@container/page mx-auto flex w-full max-w-6xl flex-col gap-4"
      data-w4-plan={plan.situationHash}
    >
      {hero.length > 0 && <div data-w4-region="hero">{hero}</div>}
      {(primary.length > 0 || hasAside) && (
        <div
          className={cx("grid min-w-0 gap-4 @2xl/page:gap-5", hasAside && "@4xl/page:grid-cols-12")}
        >
          <div
            data-w4-region="primary"
            className={cx(
              "grid min-w-0 grid-cols-12 content-start gap-4 @2xl/page:gap-5",
              hasAside && "@4xl/page:col-span-8",
            )}
          >
            {primary}
          </div>
          {hasAside && (
            <aside
              data-w4-region="aside"
              className="grid min-w-0 grid-cols-12 content-start gap-4 @2xl/page:gap-5 @4xl/page:col-span-4"
            >
              {aside}
            </aside>
          )}
        </div>
      )}
      {secondary.length > 0 && (
        <div data-w4-region="secondary" className="grid min-w-0 grid-cols-12 gap-4 @2xl/page:gap-5">
          {secondary}
        </div>
      )}
      {footer.length > 0 && (
        <footer data-w4-region="footer" className="grid min-w-0 grid-cols-12 gap-4 @2xl/page:gap-5">
          {footer}
        </footer>
      )}
    </div>
  );
}

function renderBlock(
  block: Block,
  region: Region,
  hasAside: boolean,
  device: Device,
  data: PlanData,
  manifests: ManifestSet,
  registry: Registry,
): { element: ReactElement | null; rendered: RenderedBlock } {
  const source = manifests.sources.find((s) => s.id === block.sourceId);
  const resolved = data[block.sourceId];
  const omit = (fallback: string) => ({
    element: null,
    rendered: { sourceId: block.sourceId, componentId: null, fallback },
  });
  if (!source) return omit("unknown source");
  if (!resolved || resolved.status === "unauthorized") return omit("not authorized");
  if (resolved.status === "error") return omit(`data error: ${resolved.error}`);

  const ctx: BlockContext = {
    label: source.label,
    eyebrow: source.eyebrow,
    footprint: block.footprint,
    device,
  };
  // Asides are their own 12-column grid; blocks there span the whole aside. Next to an aside the
  // primary column is 8/12 wide, so footprints are re-expressed relative to that narrower area.
  const span =
    region === "aside"
      ? 12
      : region === "primary" && hasAside
        ? block.footprint.colSpan > 6
          ? 12
          : 6
        : block.footprint.colSpan;
  const wrap = (element: ReactElement, componentId: string) => (
    <div
      key={block.sourceId}
      data-w4-block={block.sourceId}
      data-w4-component={componentId}
      className="@container col-span-12 min-w-0 @2xl/page:[grid-column:var(--w4-span)]"
      style={{ ["--w4-span" as string]: `span ${span} / span ${span}` }}
    >
      {element}
    </div>
  );

  const attempt = (componentId: string): ReactElement | null => {
    const entry = registry[componentId];
    if (!entry) return null;
    const parsed = entry.props.safeParse(entry.toProps(resolved.data, block.propsBinding));
    if (!parsed.success) return null;
    try {
      return (entry.render as (p: unknown, c: BlockContext) => ReactElement)(parsed.data, ctx);
    } catch {
      return null;
    }
  };

  const primary = attempt(block.componentId);
  if (primary)
    return {
      element: wrap(primary, block.componentId),
      rendered: { sourceId: block.sourceId, componentId: block.componentId },
    };

  const defaultId =
    source.default.component ?? compatibleComponents(source, manifests.components)[0]?.id;
  const candidates = [
    defaultId,
    ...compatibleComponents(source, manifests.components).map((c) => c.id),
  ].filter((id): id is string => !!id && id !== block.componentId);
  for (const id of new Set(candidates)) {
    const element = attempt(id);
    if (element) {
      return {
        element: wrap(element, id),
        rendered: {
          sourceId: block.sourceId,
          componentId: id,
          fallback: `${block.componentId} failed validation or render`,
        },
      };
    }
  }
  return omit(`${block.componentId} and fallbacks failed`);
}

/** What the renderer will do for each block (component used, fallbacks, omissions), without rendering. */
export function inspectPlan(
  plan: Plan,
  data: PlanData,
  manifests: ManifestSet,
  registry: Registry,
): RenderedBlock[] {
  return REGION_ORDER.flatMap((region) =>
    plan.layout[region].map(
      (block) => renderBlock(block, region, false, plan.device, data, manifests, registry).rendered,
    ),
  );
}

const REGION_ORDER: Region[] = ["hero", "primary", "aside", "secondary", "footer"];
