import { type ComponentEntry, createRegistry, LIBRARY } from "@web4kit/react";
// web4kit:imports

/**
 * Your own components, next to the library's. `pnpm web4kit add component <name>` scaffolds one
 * and registers it here; the planner can choose it on the next reload.
 */
export const ownComponents: Array<ComponentEntry<unknown>> = [
  // web4kit:components
];

/** Everything the planner may choose from, and what renders it. */
export const components = [...LIBRARY, ...(ownComponents as Array<ComponentEntry<never>>)];
export const componentManifests = components.map((c) => c.manifest);
export const registry = createRegistry(components);
