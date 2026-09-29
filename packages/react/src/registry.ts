import type { Device, Footprint } from "@web4kit/ir";
import type { ComponentManifestInput } from "@web4kit/manifest";
import type { ReactElement } from "react";
import type { z } from "zod";

export interface BlockContext {
  /** Owner-written heading from the source manifest. */
  label: string;
  eyebrow?: string | undefined;
  footprint: Footprint;
  device: Device;
}

/**
 * A registry entry ties a component manifest (what the planner may choose) to its props schema
 * and its React implementation. Props are validated before render; invalid props fall back.
 */
export interface ComponentEntry<P = unknown> {
  manifest: ComponentManifestInput;
  props: z.ZodType<P>;
  /** Build props from resolved source data and the plan's role -> path binding. */
  toProps(data: unknown, binding: Record<string, string>): unknown;
  render(props: P, ctx: BlockContext): ReactElement;
}

export function defineComponent<P>(entry: ComponentEntry<P>): ComponentEntry<P> {
  return entry;
}

export type Registry = Record<string, ComponentEntry<never>>;

export function createRegistry(entries: Array<ComponentEntry<never>>): Registry {
  return Object.fromEntries(entries.map((e) => [e.manifest.id, e]));
}
