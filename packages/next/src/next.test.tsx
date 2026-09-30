import { type ContextEnvelope, distanceRule, type SituationRule } from "@web4kit/context";
import { defineManifests, defineSource, owner } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createSiteCore, PreviewBar, requestFrom } from "./index";

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
    const off = site(false);
    expect(renderToStaticMarkup(<PreviewBar site={off} page={page} />)).toBe("");
  });
});
