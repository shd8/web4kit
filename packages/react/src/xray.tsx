import type { Plan } from "@web4kit/ir";
import type { ManifestSet } from "@web4kit/manifest";
import type { PlanData } from "./data";
import type { Registry } from "./registry";
import { inspectPlan, type RenderedBlock } from "./render";
import { type XRayCalibration, XRayClient } from "./xray-client";

export type { XRayCalibration } from "./xray-client";
/** The card that explains one block, for showing a decision outside the overlay (e.g. the launch video). */
export { BlockCard } from "./xray-client";

export interface XRayProps {
  plan: Plan;
  /**
   * What the renderer used per block, to show fallbacks. Computed from `data`, `manifests` and
   * `registry` when omitted (only in development, after the production check).
   */
  rendered?: RenderedBlock[];
  data?: PlanData;
  manifests?: ManifestSet;
  registry?: Registry;
  calibration?: XRayCalibration;
  engine?: string;
  /**
   * Render in production too. Only for public demos built from precomputed plans (the
   * playground): it sends the plan's reasoning records to the browser.
   */
  force?: boolean;
}

const isProduction = () => typeof process !== "undefined" && process.env?.NODE_ENV === "production";

/**
 * Development X-ray overlay (spec: plan-rendering). A server component: in production it returns
 * nothing before any work or client component, so no reasoning reaches the browser.
 */
export function XRay({ force, rendered, data, manifests, registry, ...props }: XRayProps) {
  if (isProduction() && !force) return null;
  const report =
    rendered ??
    (data && manifests && registry ? inspectPlan(props.plan, data, manifests, registry) : []);
  return <XRayClient {...props} rendered={report} />;
}
