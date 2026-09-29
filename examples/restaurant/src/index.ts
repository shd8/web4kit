import { CORE_FIXTURES } from "./fixtures";
import { manifests } from "./manifests";
import { BUCKETS, RULES, situationOf } from "./situation";
import { VENUE } from "./venue";

export { CORE_FIXTURES } from "./fixtures";
export { manifests, sources } from "./manifests";
export { BUCKETS, RULES, situationOf } from "./situation";
export { HOURS, scheduleData, VENUE, venueConfig } from "./venue";

/** Everything the lab and conformance suite need to run this example. */
export const restaurant = {
  id: "restaurant",
  name: VENUE.name,
  theme: "lumbre",
  manifests,
  rules: RULES,
  buckets: BUCKETS,
  fixtures: CORE_FIXTURES,
  venue: VENUE,
  situationOf,
} as const;
