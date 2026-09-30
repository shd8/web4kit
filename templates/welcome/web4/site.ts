import "server-only";
import { resolve } from "node:path";
import { loadDotEnv } from "@web4kit/decider/node";
import { createSite } from "@web4kit/next";
import { loadCalibration } from "@web4kit/planner/node";
import { engineFromEnv } from "./engine";
import { PERSONAS } from "./personas";
import { RULES } from "./situation";
import { manifests } from "./sources";

loadDotEnv(resolve(process.cwd(), ".env"));

// Jev with a JEV_API_KEY, the offline rules engine without one; W4_ENGINE=laya for free local
// planning with Laya (see web4/engine.ts).
const decider = await engineFromEnv();
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
