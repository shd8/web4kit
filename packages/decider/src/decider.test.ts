import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  CapabilitiesSchema,
  createEngineDecider,
  createRuleDecider,
  distributionConfidence,
  type EngineCall,
  isFloatingAlias,
  jevConfigFromEnv,
  loadDotEnv,
  noulConfidence,
  QuestionSchema,
  type Questions,
  RULES_CAPABILITIES,
  withFallback,
} from "./index";

const caps = { ...RULES_CAPABILITIES, locality: "cloud" as const, deterministic: false as const };

const mixed: Questions = {
  pick: { type: "choice", instructions: "Which?", criteria: { a: "A", b: "B", c: "C" } },
  rate: { type: "score", instructions: "How much?", criteria: ["none", "low", "mid", "high"] },
  yes: { type: "noul", instructions: "Is it true?" },
};

function fakeEngine(answers: Record<string, unknown>, version = "fake-1.0.0"): EngineCall {
  return async (_state, questions) => ({
    answers: Object.fromEntries(Object.keys(questions).map((id) => [id, answers[id] as never])),
    engineVersion: version,
    inputTokens: 10,
  });
}

describe("config (task 1.2)", () => {
  it("resolves the key from JEV_API_KEY and ignores TYPESAFE_API_KEY", () => {
    expect(jevConfigFromEnv({ JEV_API_KEY: "k1", TYPESAFE_API_KEY: "other" })).toEqual({
      apiKey: "k1",
      baseUrl: "https://api.typesafe.ai",
      model: "jev-1.13.0",
    });
    expect(jevConfigFromEnv({ TYPESAFE_API_KEY: "other" })).toBeUndefined();
    expect(jevConfigFromEnv({ JEV_API_KEY: "  " })).toBeUndefined();
  });

  it("loads a .env file without overwriting existing variables", () => {
    const dir = mkdtempSync(join(tmpdir(), "w4-env-"));
    const file = join(dir, ".env");
    writeFileSync(file, "W4_TEST_ONLY_VAR=from-file\n");
    expect(loadDotEnv(file)).toBe(true);
    expect(process.env.W4_TEST_ONLY_VAR).toBe("from-file");
    expect(loadDotEnv(join(dir, "missing.env"))).toBe(false);
  });

  it("keeps .env git-ignored", () => {
    const root = resolve(__dirname, "../../..");
    const out = execFileSync("git", ["check-ignore", ".env"], { cwd: root }).toString().trim();
    expect(out).toBe(".env");
  });
});

describe("question and answer shape (task 3.1)", () => {
  it("validates choice, score and noul questions and exports JSON Schema", () => {
    for (const q of Object.values(mixed)) expect(QuestionSchema.parse(q)).toBeTruthy();
    expect(() =>
      QuestionSchema.parse({ type: "score", instructions: "x", criteria: ["one"] }),
    ).toThrow();
    const schema = z.toJSONSchema(CapabilitiesSchema) as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)).toContain("maxChoiceOptions");
  });

  it("returns constrained answers with probabilities for mixed question types", async () => {
    const decider = createEngineDecider({
      id: "fake-1.0.0",
      capabilities: caps,
      call: fakeEngine({
        pick: { type: "choice", choice: "b", probabilities: { a: 0.1, b: 0.8, c: 0.1 } },
        rate: { type: "score", score: 2.4, probabilities: { 0: 0, 1: 0.1, 2: 0.4, 3: 0.5 } },
        yes: { type: "noul", noul: 0.9 },
      }),
    });
    const { answers, engineVersion } = await decider.decide({ s: "x" }, mixed);
    expect(engineVersion).toBe("fake-1.0.0");
    expect(answers.pick).toMatchObject({ type: "choice", value: "b" });
    expect(Object.keys((answers.pick as { probabilities: object }).probabilities)).toHaveLength(3);
    expect(answers.rate).toMatchObject({ type: "score", value: 2.4 });
    expect(Object.keys((answers.rate as { probabilities: object }).probabilities)).toHaveLength(4);
    expect(answers.yes).toMatchObject({ type: "noul", value: 0.9 });
  });

  it("detects floating aliases", () => {
    expect(isFloatingAlias("jev-latest")).toBe(true);
    expect(isFloatingAlias("jev-preview")).toBe(true);
    expect(isFloatingAlias("jev-1.13.0")).toBe(false);
  });
});

describe("answer validation (task 3.2)", () => {
  it("reports out-of-set choices as unanswered", async () => {
    const decider = createEngineDecider({
      id: "fake",
      capabilities: caps,
      call: fakeEngine({
        pick: { type: "choice", choice: "z", probabilities: { a: 0.2, b: 0.2, c: 0.2, z: 0.4 } },
        rate: { type: "score", score: 9, probabilities: {} },
        yes: { type: "noul", noul: 1.5 },
      }),
    });
    const { answers } = await decider.decide("s", mixed);
    expect(answers.pick).toMatchObject({ type: "unanswered" });
    expect(answers.rate).toMatchObject({ type: "unanswered" });
    expect(answers.yes).toMatchObject({ type: "unanswered" });
  });
});

describe("uniform confidence (task 3.3)", () => {
  it("matches the spike: 0.36 top probability over 5 options gives 0.20", () => {
    const c = distributionConfidence({
      aside: 0.29,
      secondary: 0.08,
      hero: 0.36,
      footer: 0.07,
      primary: 0.2,
    });
    expect(c).toBeCloseTo(0.2, 5);
  });

  it("computes noul confidence as |2p-1|", () => {
    expect(noulConfidence(0.5)).toBe(0);
    expect(noulConfidence(0.85)).toBeCloseTo(0.7, 5);
    expect(noulConfidence(0)).toBe(1);
  });

  it("ignores a misleading engine confidence and records it separately", async () => {
    const decider = createEngineDecider({
      id: "fake",
      capabilities: caps,
      call: fakeEngine({
        pick: {
          type: "choice",
          choice: "a",
          confidence: 0.95,
          probabilities: { a: 0.34, b: 0.33, c: 0.33 },
        },
      }),
    });
    const { answers } = await decider.decide("s", { pick: mixed.pick! });
    const pick = answers.pick as { confidence: number; engineConfidence: number };
    expect(pick.engineConfidence).toBe(0.95);
    expect(pick.confidence).toBeLessThan(0.05);
  });

  it("computes confidence when the engine omits it", async () => {
    const decider = createEngineDecider({
      id: "fake",
      capabilities: caps,
      call: fakeEngine({ pick: { choice: "a", probabilities: { a: 0.9, b: 0.05, c: 0.05 } } }),
    });
    const { answers } = await decider.decide("s", { pick: mixed.pick! });
    expect((answers.pick as { confidence: number }).confidence).toBeCloseTo(0.85, 5);
  });
});

describe("request fitting (task 3.4)", () => {
  it("splits 60 questions into 3 concurrent requests and returns 60 answers", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const call = vi.fn<EngineCall>(async (_s, questions) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return {
        answers: Object.fromEntries(Object.keys(questions).map((id) => [id, { noul: 0.7 }])),
        engineVersion: "fake",
        inputTokens: 1,
      };
    });
    const decider = createEngineDecider({
      id: "fake",
      capabilities: { ...caps, maxQuestionsPerRequest: 20 },
      call,
    });
    const questions: Questions = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [
        `q${i}`,
        { type: "noul" as const, instructions: `Q${i}?` },
      ]),
    );
    const result = await decider.decide("s", questions);
    expect(call).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3);
    expect(Object.keys(result.answers).sort()).toEqual(Object.keys(questions).sort());
    expect(result.usage.requests).toBe(3);
  });
});

describe("rules decider (task 3.5)", () => {
  it("is deterministic and uses no network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rules = createRuleDecider((q) =>
      q.type === "choice"
        ? { type: "choice", value: "c" }
        : q.type === "score"
          ? { type: "score", value: 3 }
          : { type: "noul", value: true },
    );
    const a = await rules.decide({ x: 1 }, mixed);
    const b = await rules.decide({ x: 1 }, mixed);
    expect(a).toEqual(b);
    expect(a.answers.pick).toMatchObject({ value: "c", confidence: 1 });
    expect(a.answers.rate).toMatchObject({ value: 3 });
    expect(a.answers.yes).toMatchObject({ value: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("engine failure fallback (task 3.6)", () => {
  it("answers with rules and records the reason when the engine is rate-limited", async () => {
    const primary = createEngineDecider({
      id: "jev-1.13.0",
      capabilities: caps,
      call: async () => {
        throw new Error("429 Too Many Requests after 3 retries");
      },
    });
    const rules = createRuleDecider(() => undefined);
    const decider = withFallback(primary, rules);
    const { answers } = await decider.decide("s", mixed);
    for (const answer of Object.values(answers)) {
      expect(answer.provenance.engine).toBe("rules");
      expect(answer.provenance.fallbackReason).toContain("429");
    }
  });
});
