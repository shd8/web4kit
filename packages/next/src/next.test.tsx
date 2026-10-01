import { type ContextEnvelope, distanceRule, type SituationRule } from "@web4kit/context";
import { createEngineDecider, RULES_CAPABILITIES } from "@web4kit/decider";
import { defineManifests, defineSource, owner } from "@web4kit/manifest";
import type { CalibrationProfile } from "@web4kit/planner";
import { libraryManifests } from "@web4kit/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { calibrationReport, createSiteCore, engineNotice, PreviewBar, requestFrom } from "./index";

const HOTEL = { lat: 41.1405, lng: -8.6132 };
const stayRule: SituationRule = (e) => ({
  stayPhase: e.firstParty?.arrival ? "in-house" : "researching",
});
const seen: Array<Record<string, string> | undefined> = [];
const manifests = defineManifests({
  site: "t",
  components: libraryManifests,
  sources: [
    defineSource({
      id: "rooms",
      shape: "list",
      label: "Rooms",
      what: "Rooms with prices",
      fields: { title: owner("name") },
      mustExclude: { stayPhase: ["in-house"] },
      fetch: async () => [{ name: "Double" }],
    }),
    defineSource({
      id: "check-in",
      shape: "record",
      label: "Check-in",
      what: "Check-in",
      fields: { title: owner("t") },
      fetch: async (ctx) => {
        seen.push(ctx.situation as Record<string, string>);
        return { t: ctx.situation?.stayPhase === "in-house" ? "Check-out 11:00" : "From 15:00" };
      },
    }),
  ],
});
const persona: ContextEnvelope = {
  utm: {},
  languages: ["en"],
  device: "desktop",
  saveData: false,
  consent: false,
  now: "2026-10-02T09:00:00Z",
  firstParty: { arrival: "2026-10-01" },
};
const enrichCalls: string[] = [];
const site = (previews: boolean) =>
  createSiteCore({
    manifests,
    situation: [stayRule, distanceRule({ location: HOTEL })],
    personas: [{ name: "guest", title: "Staying guest", envelope: persona }],
    previews,
    enrich: async (env, req) => {
      enrichCalls.push(req.url);
      return new URL(req.url).searchParams.get("booking") === "AB12"
        ? { ...env, firstParty: { arrival: "2026-10-01" } }
        : env;
    },
  });
const ids = (page: { plan: { layout: Record<string, Array<{ sourceId: string }>> } }) =>
  Object.values(page.plan.layout)
    .flat()
    .map((b) => b.sourceId);

describe("@web4kit/next site pipeline (tasks 6.2-6.4)", () => {
  it("plans, resolves data with the situation, and enriches real requests", async () => {
    const s = site(false);
    const anon = await s.handle({ url: "https://h.example/", headers: {} });
    expect(anon.situation.stayPhase).toBe("researching");
    expect(ids(anon)).toContain("rooms");
    expect(anon.data["check-in"]).toEqual({ status: "ok", data: { t: "From 15:00" } });

    const booked = await s.handle({ url: "https://h.example/?booking=AB12", headers: {} });
    expect(booked.situation.stayPhase).toBe("in-house");
    expect(ids(booked)).not.toContain("rooms");
    expect(booked.data["check-in"]).toEqual({ status: "ok", data: { t: "Check-out 11:00" } });
    expect(seen.at(-1)).toMatchObject({ stayPhase: "in-house" });
  });

  it("previews personas only when enabled, without enrichment", async () => {
    enrichCalls.length = 0;
    const dev = await site(true).handle({ url: "https://h.example/?as=guest", headers: {} });
    expect(dev.persona).toBe("guest");
    expect(dev.envelope).toBe(persona);
    expect(enrichCalls).toEqual([]);

    const prod = await site(false).handle({ url: "https://h.example/?as=guest", headers: {} });
    expect(prod.persona).toBeUndefined();
    expect(prod.situation.stayPhase).toBe("researching");

    const unknown = await site(true).handle({ url: "https://h.example/?as=nobody", headers: {} });
    expect(unknown.persona).toBeUndefined();
    expect(enrichCalls).toHaveLength(2);
  });

  it("defaults previews off in production", () => {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(createSiteCore({ manifests, situation: [stayRule] }).previews).toBe(false);
    } finally {
      process.env.NODE_ENV = before;
    }
    expect(createSiteCore({ manifests, situation: [stayRule] }).previews).toBe(true);
  });

  it("reports stats across pages", async () => {
    const s = site(false);
    await s.handle({ url: "https://h.example/", headers: {} });
    await s.handle({ url: "https://h.example/", headers: {} });
    await s.handle({ url: "https://h.example/?booking=AB12", headers: {} });
    expect(s.stats()).toMatchObject({ pages: 3, cacheHits: 1, distinctSituations: 2 });
  });

  it("builds the same request from Next headers and search params", async () => {
    const headers = new Headers({ host: "h.example", "accept-language": "pt-PT" });
    const req = requestFrom(headers, { booking: "AB12", tag: ["a", "b"], none: undefined });
    expect(req.url).toBe("http://h.example/?booking=AB12&tag=a&tag=b");
    const s = site(false);
    const viaNext = await s.handle(req);
    const direct = await s.handle({
      url: "http://h.example/?booking=AB12&tag=a&tag=b",
      headers: { host: "h.example", "accept-language": "pt-PT" },
    });
    expect(viaNext.plan).toEqual(direct.plan);
  });

  it("preview bar renders personas in dev and nothing when disabled", async () => {
    const dev = site(true);
    const page = await dev.handle({ url: "https://h.example/?as=guest", headers: {} });
    const html = renderToStaticMarkup(<PreviewBar site={dev} page={page} statsHref="/stats" />);
    expect(html).toContain('href="/?as=guest"');
    expect(html).toContain("Staying guest");
    expect(html).toContain('href="/stats"');
    expect(html).toContain("data-w4-engine-notice");
    expect(html).toContain("hand-written heuristics");
    const off = site(false);
    expect(renderToStaticMarkup(<PreviewBar site={off} page={page} />)).toBe("");
  });

  it("says when rules plan the page instead of a calibrated model", () => {
    expect(engineNotice("rules", { status: "none" })).toMatch(/JEV_API_KEY or W4_ENGINE=laya/);
    expect(engineNotice("jev-1.13.0", { status: "none" })).toMatch(/no calibration profile/);
    expect(
      engineNotice("jev-1.13.0", { status: "stale", version: "1", reason: "manifests changed" }),
    ).toMatch(/stale \(manifests changed\)/);
    expect(engineNotice("jev-1.13.0", { status: "active", version: "1" })).toBeUndefined();
  });
});

/** Fake engine answering every question confidently; counts its calls. */
function fakeEngine() {
  let calls = 0;
  const decider = createEngineDecider({
    id: "fake-2.0.0",
    capabilities: { ...RULES_CAPABILITIES, locality: "cloud", deterministic: false },
    call: async (_state, questions) => {
      calls++;
      const answers: Record<string, unknown> = {};
      for (const [id, q] of Object.entries(questions)) {
        if (q.type === "noul") answers[id] = { noul: 0.97 };
        if (q.type === "score")
          answers[id] = {
            score: 1,
            probabilities: Object.fromEntries(
              q.criteria.map((_, i) => [String(i), i === 1 ? 0.97 : 0.01]),
            ),
          };
        if (q.type === "choice") {
          const opts = Object.keys(q.criteria);
          answers[id] = {
            choice: opts[0],
            probabilities: Object.fromEntries(opts.map((o, i) => [o, i === 0 ? 0.96 : 0.04])),
          };
        }
      }
      return { answers: answers as never, engineVersion: "fake-2.0.0", inputTokens: 10 };
    },
  });
  return { decider, calls: () => calls };
}
/** Profile measured before the rooms description changed: partial, rooms stale. */
const partialProfile = (): CalibrationProfile => ({
  engine: "fake-2.0.0",
  version: "cal-test",
  manifestVersion: "dec-old",
  sourceVersions: { ...manifests.sourceDeciderVersions, rooms: "dec-old" },
  createdAt: "2026-10-01T00:00:00Z",
  entries: Object.fromEntries(
    ["A.relevance", "A.salience", "B.component", "C.region", "C.prominence"].map((k) => [
      `${k}|english`,
      { acceptThreshold: 0.5, accuracy: 0.9, overlap: 0, sampleSize: 100, uncalibrated: false },
    ]),
  ),
});
const decidedBy = (page: {
  plan: { layout: Record<string, Array<{ why: Array<{ decidedBy: string }> }>> };
}) =>
  Object.values(page.plan.layout)
    .flat()
    .flatMap((b) => b.why.map((w) => w.decidedBy));

describe("development gating by default (dx-dev-loop 5.1)", () => {
  const engineSite = (over: Partial<Parameters<typeof createSiteCore>[0]> = {}) =>
    createSiteCore({
      manifests,
      situation: [stayRule],
      decider: fakeEngine().decider,
      calibration: partialProfile(),
      cache: false,
      ...over,
    });

  it("records the stale source's decisions as ungated under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const s = engineSite();
      expect(s.planner.developmentGating).toBe(true);
      expect(s.planner.calibrationStatus).toMatchObject({
        status: "partial",
        staleSources: ["rooms"],
      });
      const page = await s.handle({ url: "https://h.example/", headers: {} });
      expect(decidedBy(page)).toContain("ungated");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("records nothing as ungated when turned off or in production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const off = await engineSite({ developmentGating: false }).handle({
        url: "https://h.example/",
        headers: {},
      });
      expect(decidedBy(off)).not.toContain("ungated");
    } finally {
      vi.unstubAllEnvs();
    }
    vi.stubEnv("NODE_ENV", "production");
    try {
      const prod = engineSite({ developmentGating: true });
      expect(prod.planner.developmentGating).toBe(false);
      const page = await prod.handle({ url: "https://h.example/", headers: {} });
      expect(decidedBy(page)).not.toContain("ungated");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("build-time calibration warning (dx-dev-loop 5.2)", () => {
  const build = () => vi.stubEnv("NEXT_PHASE", "phase-production-build");

  it("warns naming engine, status, stale sources and the fix, without calling the decider", () => {
    build();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const engine = fakeEngine();
      createSiteCore({
        manifests,
        situation: [stayRule],
        decider: engine.decider,
        calibration: partialProfile(),
      });
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]![0]);
      for (const part of ["fake-2.0.0", "partial", "rooms", "pnpm calibrate"])
        expect(message).toContain(part);
      expect(engine.calls()).toBe(0);
    } finally {
      warn.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("fails the build in error mode or with W4_STRICT_CALIBRATION=1", () => {
    build();
    try {
      const make = (over = {}) =>
        createSiteCore({
          manifests,
          situation: [stayRule],
          decider: fakeEngine().decider,
          calibration: partialProfile(),
          ...over,
        });
      expect(() => make({ calibrationCheck: "error" })).toThrow(
        /partial: stale for rooms.*pnpm calibrate/,
      );
      vi.stubEnv("W4_STRICT_CALIBRATION", "1");
      expect(() => make()).toThrow(/partial/);
      expect(() => make({ calibrationCheck: "off" })).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports missing for an engine without a profile, and stays quiet for rules or outside a build", () => {
    expect(
      calibrationReport(
        createSiteCore({ manifests, situation: [stayRule], decider: fakeEngine().decider }),
      ),
    ).toMatchObject({ status: "missing", ok: false, fix: "pnpm calibrate" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      createSiteCore({ manifests, situation: [stayRule], decider: fakeEngine().decider }); // not a build
      build();
      const rules = createSiteCore({ manifests, situation: [stayRule] });
      expect(calibrationReport(rules)).toMatchObject({ status: "rules", ok: true });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe("partial calibration in the preview bar (dx-dev-loop 5.3)", () => {
  it("names the stale sources and says they are ungated in development", async () => {
    const dev = site(true);
    const page = await dev.handle({ url: "https://h.example/", headers: {} });
    const partial = {
      personas: dev.personas,
      previews: true,
      previewParam: "as",
      planner: {
        calibrationStatus: {
          status: "partial" as const,
          version: "cal-1",
          staleSources: ["rooms"],
        },
        developmentGating: true,
      },
    };
    const html = renderToStaticMarkup(
      <PreviewBar
        site={partial}
        page={{ ...page, plan: { ...page.plan, engine: "jev-1.13.0" } }}
      />,
    );
    expect(html).toContain("data-w4-engine-notice");
    expect(html).toContain("stale for rooms");
    expect(html).toContain("ungated here");
    expect(
      engineNotice("jev-1.13.0", { status: "partial", version: "1", staleSources: ["rooms"] }),
    ).toMatch(/stale for rooms, so their answers fall back to rules/);
  });
});
