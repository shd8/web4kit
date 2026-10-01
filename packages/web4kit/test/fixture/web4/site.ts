// A site for `web4kit check` tests; FIXTURE picks its calibration state.
import "server-only";
import { createEngineDecider, RULES_CAPABILITIES } from "@web4kit/decider";
import { defineManifests, defineSource, owner } from "@web4kit/manifest";
import { createSiteCore } from "@web4kit/next";
import type { CalibrationProfile } from "@web4kit/planner";
import { libraryManifests } from "@web4kit/react";

const manifests = defineManifests({
  site: "fixture",
  components: libraryManifests,
  sources: ["news", "offer"].map((id) =>
    defineSource({
      id,
      shape: "record",
      label: id,
      what: `The ${id}`,
      fields: { title: owner("title") },
      fetch: async () => ({ title: id }),
    }),
  ),
});
const decider = createEngineDecider({
  id: "fake-1.0.0",
  capabilities: { ...RULES_CAPABILITIES, locality: "cloud" },
  call: async () => {
    throw new Error("check must not call the decider");
  },
});
const profile = (sourceVersions: Record<string, string>): CalibrationProfile => ({
  engine: "fake-1.0.0",
  version: "cal-fixture",
  manifestVersion: manifests.deciderVersion,
  sourceVersions,
  createdAt: "2026-10-01T00:00:00Z",
  entries: {},
});

const state = process.env.FIXTURE ?? "rules";
export const site = createSiteCore({
  manifests,
  situation: [],
  ...(state === "rules" ? {} : { decider }),
  ...(state === "active" ? { calibration: profile(manifests.sourceDeciderVersions) } : {}),
  ...(state === "partial"
    ? { calibration: profile({ ...manifests.sourceDeciderVersions, offer: "dec-old" }) }
    : {}),
});
