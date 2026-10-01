import { resolve } from "node:path";
import { manifests as restaurantManifests } from "@web4kit/example-restaurant";
import type { ManifestSet } from "@web4kit/manifest";
import { manifests as hotelManifests } from "../../../templates/hotel/web4/manifests";
import { manifests as welcomeManifests } from "../../../templates/welcome/web4/sources";
import type { Grid } from "./grid";
import { GRIDS } from "./grids";

const ROOT = resolve(import.meta.dirname, "../../..");

export interface DemoSite {
  grid: Grid;
  manifests: ManifestSet;
  /** Directory holding the site's calibration profiles, as in production. */
  calibrationDir: string;
}

export const SITES: Record<Grid["site"], DemoSite> = {
  restaurant: {
    grid: GRIDS.restaurant,
    manifests: restaurantManifests,
    calibrationDir: resolve(ROOT, "calibration/casa-lumbre"),
  },
  hotel: {
    grid: GRIDS.hotel,
    manifests: hotelManifests,
    calibrationDir: resolve(ROOT, "templates/hotel/calibration"),
  },
  welcome: {
    grid: GRIDS.welcome,
    manifests: welcomeManifests,
    calibrationDir: resolve(ROOT, "templates/welcome/calibration"),
  },
};

export const SITE_IDS = Object.keys(SITES) as Array<Grid["site"]>;
