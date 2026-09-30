import "server-only";
import { resolve } from "node:path";
import { loadDotEnv } from "@web4kit/decider/node";
import { createSite } from "@web4kit/next";
import { loadCalibration } from "@web4kit/planner/node";
import { engineFromEnv } from "./engine";
import { PERSONAS } from "./fixtures";
import { BOOKINGS } from "./hotel";
import { manifests } from "./manifests";
import { RULES } from "./situation";

loadDotEnv(resolve(process.cwd(), ".env"));

// Jev with a JEV_API_KEY, rules without one; W4_ENGINE=laya plans with Laya locally (engine.ts).
const decider = await engineFromEnv();
// The planner ignores a profile measured against other manifests (site.planner.calibrationStatus).
const calibration = decider
  ? loadCalibration(resolve(process.cwd(), "calibration"), decider.id)
  : undefined;

/**
 * The whole web4 pipeline for this site. In development, `?as=<persona>` previews a persona;
 * in production only real request signals are used.
 */
export const site = createSite({
  manifests,
  situation: RULES,
  ...(decider ? { decider } : {}),
  ...(calibration ? { calibration } : {}),
  personas: PERSONAS,
  // First-party facts the hotel already knows: booking dates from a confirmation-email link.
  enrich: (envelope, request) => {
    const code = new URL(request.url).searchParams.get("booking");
    const booked = code ? BOOKINGS[code] : undefined;
    return booked
      ? { ...envelope, firstParty: { arrival: booked.arrival, nights: String(booked.nights) } }
      : envelope;
  },
});
