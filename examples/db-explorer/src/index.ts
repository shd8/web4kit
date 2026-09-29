import { BUCKETS, RULES, situationOf } from "./core";
import { manifests } from "./manifests";

export * from "./core";
export { manifests, sources } from "./manifests";
export { CORE_FIXTURES } from "./suite";

export const explorer = {
  id: "db-explorer",
  name: "Meridian Supply",
  theme: "ops",
  manifests,
  rules: RULES,
  buckets: BUCKETS,
  situationOf,
} as const;
