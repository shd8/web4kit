/**
 * The four sites in web4-bench (spec: benchmark). The example sites are the development split;
 * the starters are held out as the test split. Same fixtures as the conformance suite and the
 * ablation.
 */
import type { SituatedFixture } from "@web4kit/conformance";
import type { BucketSpec } from "@web4kit/context";
import * as explorer from "@web4kit/example-db-explorer";
import { suiteFixtures as explorerSuite } from "@web4kit/example-db-explorer/suite";
import * as restaurant from "@web4kit/example-restaurant";
import { suiteFixtures as restaurantSuite } from "@web4kit/example-restaurant/suite";
import type { ManifestSet } from "@web4kit/manifest";
import { suiteFixtures as hotelSuite } from "../../templates/hotel/web4/fixtures";
import { manifests as hotelManifests } from "../../templates/hotel/web4/manifests";
import { BUCKETS as hotelBuckets } from "../../templates/hotel/web4/situation";
import { suiteFixtures as welcomeSuite } from "../../templates/welcome/web4/personas";
import { BUCKETS as welcomeBuckets } from "../../templates/welcome/web4/situation";
import { manifests as welcomeManifests } from "../../templates/welcome/web4/sources";
import type { Split } from "./format";

export interface BenchSite {
  key: string;
  title: string;
  split: Split;
  manifests: ManifestSet;
  buckets: BucketSpec;
  fixtures: () => SituatedFixture[];
}

export const SITES: BenchSite[] = [
  {
    key: "restaurant",
    title: "Casa Lumbre (restaurant)",
    split: "dev",
    manifests: restaurant.manifests,
    buckets: restaurant.BUCKETS,
    fixtures: () => restaurantSuite(160),
  },
  {
    key: "explorer",
    title: "Meridian Supply (database explorer)",
    split: "dev",
    manifests: explorer.manifests,
    buckets: explorer.BUCKETS,
    fixtures: () => explorerSuite(),
  },
  {
    key: "hotel",
    title: "Casa Ribeira (hotel starter)",
    split: "test",
    manifests: hotelManifests,
    buckets: hotelBuckets,
    fixtures: () => hotelSuite(),
  },
  {
    key: "welcome",
    title: "Welcome starter",
    split: "test",
    manifests: welcomeManifests,
    buckets: welcomeBuckets,
    fixtures: () => welcomeSuite(),
  },
];

export const siteByKey = (key: string) => {
  const site = SITES.find((s) => s.key === key);
  if (!site) throw new Error(`unknown site ${key}: ${SITES.map((s) => s.key).join(", ")}`);
  return site;
};

/** Stable item id: site and fixture name. */
export const itemId = (site: string, fixture: string) => `${site}/${fixture}`;
