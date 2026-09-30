import "server-only";
import { resolve } from "node:path";
import { createJevDecider, jevConfigFromEnv } from "@web4kit/decider";
import { loadDotEnv } from "@web4kit/decider/node";
import { createSite } from "@web4kit/next";
import { loadCalibration } from "@web4kit/planner/node";
import { PERSONAS } from "./personas";
import { RULES } from "./situation";
import { manifests } from "./sources";

loadDotEnv(resolve(process.cwd(), ".env"));

// With JEV_API_KEY, pages are planned by TypeSafe Jev; without it, by the offline rules engine.
const jev = jevConfigFromEnv();
const decider = jev ? createJevDecider(jev) : undefined;
const calibration = decider
  ? loadCalibration(resolve(process.cwd(), "calibration"), decider.id)
  : undefined;

/** The whole web4 pipeline: context -> situation -> one planning round -> data. */
export const site = createSite({
  manifests,
  situation: RULES,
  ...(decider ? { decider } : {}),
  ...(calibration ? { calibration } : {}),
  personas: PERSONAS,
});
