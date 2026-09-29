import { describe, expect, it, vi } from "vitest";
import {
  createCascadeDecider,
  createEngineDecider,
  createSystemOneHttpDecider,
  type EngineCall,
  JEV_CAPABILITIES,
  type Questions,
  RULES_CAPABILITIES,
} from "./index";

const questions: Questions = {
  a: { type: "noul", instructions: "A?", meta: { kind: "A.relevance", subject: "x" } },
  b: {
    type: "choice",
    instructions: "B?",
    criteria: { l: "L", r: "R" },
    meta: { kind: "C.region", subject: "x" },
  },
};

const ok = (model = "jev-1.13.0") =>
  new Response(
    JSON.stringify({
      model,
      answers: {
        a: { type: "noul", noul: 0.9 },
        b: { type: "choice", choice: "l", probabilities: { l: 0.7, r: 0.3 } },
      },
      usage: { input_tokens: 42 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

describe("System One HTTP adapter (task 10.1)", () => {
  it("posts the wire format without web4 metadata and reports the exact version", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("jev-latest");
      expect(body.questions.a.meta).toBeUndefined();
      expect((init?.headers as Record<string, string> | undefined)?.authorization).toBe("Bearer k");
      return ok("jev-1.13.0");
    });
    const d = createSystemOneHttpDecider({
      baseUrl: "https://api.example/",
      model: "jev-latest",
      apiKey: "k",
      capabilities: JEV_CAPABILITIES,
      fetch: fetchMock as typeof fetch,
    });
    const result = await d.decide({ s: "x" }, questions);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.example/v1/systemone");
    expect(result.engineVersion).toBe("jev-1.13.0");
    expect(result.usage.inputTokens).toBe(42);
    expect(result.answers.b).toMatchObject({ value: "l", provenance: { engine: "jev-1.13.0" } });
  });

  it("retries 429 honouring retry-after, then fails with the status", async () => {
    const limited = () =>
      new Response("slow down", { status: 429, headers: { "retry-after": "0.01" } });
    const retried = vi
      .fn(async () => limited())
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(ok());
    const d1 = createSystemOneHttpDecider({
      baseUrl: "http://x",
      model: "m",
      capabilities: JEV_CAPABILITIES,
      fetch: retried as unknown as typeof fetch,
    });
    await expect(d1.decide("s", questions)).resolves.toBeTruthy();
    expect(retried).toHaveBeenCalledTimes(2);

    const always = vi.fn(async () => limited());
    const d2 = createSystemOneHttpDecider({
      baseUrl: "http://x",
      model: "m",
      capabilities: JEV_CAPABILITIES,
      retries: 2,
      fetch: always as unknown as typeof fetch,
    });
    await expect(d2.decide("s", questions)).rejects.toThrow(/429/);
    expect(always).toHaveBeenCalledTimes(3);
  });
});

describe("cascade adapter (task 10.4)", () => {
  const engine = (id: string, noul: number, choiceP: number) => {
    const call = vi.fn<EngineCall>(async (_s, qs) => ({
      answers: Object.fromEntries(
        Object.keys(qs).map((k) => [
          k,
          k === "a" ? { noul } : { choice: "l", probabilities: { l: choiceP, r: 1 - choiceP } },
        ]),
      ),
      engineVersion: id,
      inputTokens: 1,
    }));
    return { call, decider: createEngineDecider({ id, capabilities: RULES_CAPABILITIES, call }) };
  };

  it("re-asks only below-threshold questions and records the deciding engine", async () => {
    const cheap = engine("laya", 0.99, 0.55); // noul confident, choice weak
    const strong = engine("jev-1.13.0", 0.9, 0.95);
    const cascade = createCascadeDecider({
      cheap: cheap.decider,
      strong: strong.decider,
      threshold: () => 0.5,
    });
    const { answers } = await cascade.decide("s", questions);
    expect(Object.keys(strong.call.mock.calls[0]![1])).toEqual(["b"]);
    expect(answers.a!.provenance.engine).toBe("laya");
    expect(answers.b!.provenance.engine).toBe("jev-1.13.0");
  });

  it("always escalates uncalibrated kinds", async () => {
    const cheap = engine("laya", 0.99, 0.99);
    const strong = engine("jev-1.13.0", 0.9, 0.95);
    const cascade = createCascadeDecider({
      cheap: cheap.decider,
      strong: strong.decider,
      threshold: (q) => (q.meta?.kind === "C.region" ? undefined : 0.5),
    });
    const { answers } = await cascade.decide("s", questions);
    expect(answers.b!.provenance.engine).toBe("jev-1.13.0");
    expect(answers.a!.provenance.engine).toBe("laya");
  });
});
