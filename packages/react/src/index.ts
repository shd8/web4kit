import type { ComponentManifestInput } from "@web4kit/manifest";
import { graphView, timeseriesChart } from "./components/charts";
import {
  dataTable,
  eventsTimeline,
  kpiTiles,
  menuList,
  recordCard,
  reviewHighlights,
} from "./components/lists";
import { captionList, heroCarousel, imageGrid, socialGrid } from "./components/media";
import { directionsBar, hoursCard, mapCard, statusBanner } from "./components/place";
import { type ComponentEntry, createRegistry } from "./registry";

export * from "./data";
export * from "./primitives";
export * from "./registry";
export * from "./render";

/** The curated component library (design D9). */
export const LIBRARY = [
  heroCarousel,
  imageGrid,
  socialGrid,
  captionList,
  menuList,
  dataTable,
  eventsTimeline,
  reviewHighlights,
  kpiTiles,
  recordCard,
  hoursCard,
  statusBanner,
  mapCard,
  directionsBar,
  timeseriesChart,
  graphView,
] as unknown as Array<ComponentEntry<never>>;

export const defaultRegistry = createRegistry(LIBRARY);

/** Component manifests for the planner, straight from the registry so the two never drift. */
export const libraryManifests: ComponentManifestInput[] = LIBRARY.map((e) => e.manifest);
