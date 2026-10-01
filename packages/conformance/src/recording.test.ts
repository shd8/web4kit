import type { ContextEnvelope } from "@web4kit/context";
import {
  createEngineDecider,
  type EngineCall,
  JEV_CAPABILITIES,
  type Questions,
} from "@web4kit/decider";
import { defineManifests, defineSource, owner } from "@web4kit/manifest";
import { CalibrationProfileSchema } from "@web4kit/planner";
import { describe, expect, it } from "vitest";
import {
  createRecordingDecider,
  createReplayDecider,
  label,
  runEngine,
  type SituatedFixture,
  UnrecordedQuestionsError,
} from "./index";

const footprint = Object.fromEntries(
  ["mobile", "tablet", "desktop"].map((d) => [d, { colSpan: 12, rowSpan: 2 }]),
) as never;
const manifests = defineManifests({
  site: "recording-test",
  components: [
    {
      id: "rows",
      what: "Rows",
      accepts: [{ shape: "list", requires: ["title"] }],
      affordances: ["browse"],
      footprint,
      mediaHeavy: false,
    },
  ],
  sources: [
    defineSource({
      id: "menu",
      shape: "list",
      label: "Menu",
      what: "Tonight's dishes",
      fields: { title: owner("name") },
      // Off by default: an engine that says "relevant" is right, the default is wrong.
      default: { include: false },
      fetch: async () => [],
    }),
  ],
});
const envelope: ContextEnvelope = {
  utm: {},
  languages: [],
  device: "mobile",
  saveData: false,
  consent: false,
  now: "2026-10-01T18:00:00Z",
};
const fixtures: SituatedFixture[] = ["a", "b"].map((name) => ({
  name,
  envelope,
  situation: { device: name === "a" ? "mobile" : "desktop" },
  invariants: [],
  expected: [label.relevant("menu")],
}));

function countingEngine() {
  let requests = 0;
  const call: EngineCall = async (_state, questions: Questions) => {
    requests++;
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === "noul") answers[id] = { noul: 0.97 };
      else if (q.type === "score")
        answers[id] = {
          score: 2,
          probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), i === 2 ? 1 : 0])),
        };
      else {
        const opts = Object.keys(q.criteria);
        answers[id] = {
          choice: opts[0],
          probabilities: Object.fromEntries(opts.map((o, i) => [o, i === 0 ? 1 : 0])),
        };
      }
    }
    return { answers: answers as never, engineVersion: "fake-1.0.0", inputTokens: 10 };
  };
  const decider = createEngineDecider({
    id: "fake-1.0.0",
    capabilities: { ...JEV_CAPABILITIES, deterministic: false },
    call,
  });
  return { decider, requests: () => requests };
}

describe("recording and replay (task 1.3)", () => {
  it("replays a run exactly, without calling the engine", async () => {
    const engine = countingEngine();
    const recorder = createRecordingDecider(engine.decider);
    const original = await runEngine({ manifests, fixtures, decider: recorder, repeats: 3 });
    expect(engine.requests()).toBe(6);

    const recordings = JSON.parse(JSON.stringify(recorder.recordings()));
    const replay = createReplayDecider(recordings, engine.decider.capabilities);
    const again = await runEngine({ manifests, fixtures, decider: replay, repeats: 3 });
    expect(engine.requests()).toBe(6);
    expect(replay.calls()).toBe(6);
    expect(again.byKind).toEqual(original.byKind);
    expect(again.decisionAccuracy).toEqual(original.decisionAccuracy);
    expect(again.profile?.entries).toEqual(original.profile?.entries);
  });

  it("fails on a question set that was never recorded, naming the fixture", async () => {
    const replay = createReplayDecider(
      { engine: "fake-1.0.0", engineVersion: "fake-1.0.0", sets: {} },
      JEV_CAPABILITIES,
    );
    await expect(runEngine({ manifests, fixtures, decider: replay })).rejects.toThrow(
      /fixture a: no recorded answers/,
    );
    await expect(replay.decide({}, {})).rejects.toBeInstanceOf(UnrecordedQuestionsError);
  });

  it("scores raw answers and final decisions separately", async () => {
    // Two samples are too few to calibrate: the engine's correct "relevant" is gated to rules,
    // whose default leaves the menu off the page.
    const run = await runEngine({ manifests, fixtures, decider: countingEngine().decider });
    expect(run.byKind["A.relevance|english"]?.accuracy).toBe(1);
    expect(run.decisionAccuracy["A.relevance|english"]).toEqual({ samples: 2, accuracy: 0 });
  });
});

describe("per-source versions in profiles (dx-dev-loop 1.2)", () => {
  it("records every source's decider version", async () => {
    const run = await runEngine({ manifests, fixtures, decider: countingEngine().decider });
    expect(run.profile?.sourceVersions).toEqual(manifests.sourceDeciderVersions);
    expect(Object.keys(run.profile?.sourceVersions ?? {})).toEqual(
      manifests.sources.map((s) => s.id),
    );
  });

  it("still parses a v1 profile without per-source versions", () => {
    const v1 = {
      engine: "fake-1.0.0",
      version: "cal-x",
      manifestVersion: manifests.deciderVersion,
      createdAt: "2026-01-01T00:00:00.000Z",
      entries: {},
    };
    expect(CalibrationProfileSchema.parse(v1).sourceVersions).toBeUndefined();
  });
});
