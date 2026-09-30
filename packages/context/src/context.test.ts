import { describe, expect, it } from "vitest";
import {
  assertSituation,
  CONSENT_COOKIE,
  CORE_BUCKETS,
  CORE_RULES,
  type ContextEnvelope,
  collectEnvelope,
  DAY_PART_BUCKET,
  dayPartRule,
  deriveSituation,
  distanceRule,
  mealWindowRule,
  openingHoursRule,
  pointAtDistance,
  resolveContext,
  situationHash,
  VENUE_BUCKETS,
  venueRules,
} from "./index";

const MADRID = { lat: 40.4168, lng: -3.7038 };
const venue = {
  location: MADRID,
  timezone: "Europe/Madrid",
  // Open every day 13:00-16:00 and 20:00-23:00
  hours: [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, open: "13:00", close: "16:00" },
    { day, open: "20:00", close: "23:00" },
  ]),
};
const rules = [...CORE_RULES, ...venueRules(venue)];
const spec = { ...CORE_BUCKETS, ...VENUE_BUCKETS };

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("Tier 0 signals (task 4.1)", () => {
  it("records Instagram arrival and mobile device from the first request", () => {
    const { envelope } = collectEnvelope({
      url: "https://casa.example/?src=instagram&utm_campaign=Brunch",
      headers: {
        "user-agent": IPHONE,
        "accept-language": "en-GB,en;q=0.9,es;q=0.5",
        "save-data": "on",
        "x-vercel-ip-latitude": "48.85",
        "x-vercel-ip-longitude": "2.35",
        "x-vercel-ip-timezone": "Europe/Paris",
      },
    });
    expect(envelope.src).toBe("instagram");
    expect(envelope.utm).toEqual({ utm_campaign: "brunch" });
    expect(envelope.device).toBe("mobile");
    expect(envelope.languages).toEqual(["en-GB", "en", "es"]);
    expect(envelope.saveData).toBe(true);
    expect(envelope.geo).toMatchObject({ lat: 48.85, lng: 2.35 });
    expect(envelope.timezone).toBe("Europe/Paris");
  });

  it("marks missing signals unknown and still derives a situation", () => {
    const { envelope } = collectEnvelope({ url: "/", headers: {} });
    expect(envelope.referrer).toBeUndefined();
    expect(envelope.geo).toBeUndefined();
    expect(envelope.device).toBe("unknown");
    const situation = deriveSituation(envelope, rules);
    expect(situation).toMatchObject({ arrival: "direct", visitor: "unknown", device: "unknown" });
    assertSituation(situation, spec);
  });

  it("classifies referrers", () => {
    const arrival = (referer: string) =>
      deriveSituation(collectEnvelope({ url: "/", headers: { referer } }).envelope, rules).arrival;
    expect(arrival("https://www.google.com/maps/place/x")).toBe("transactional");
    expect(arrival("https://www.tripadvisor.com/Restaurant")).toBe("evaluating");
    expect(arrival("https://l.instagram.com/")).toBe("visual");
  });
});

describe("situation buckets (task 4.2)", () => {
  it("turns 900 km / 20:30 / open until 23:00 into labels with no raw values", () => {
    const envelope: ContextEnvelope = {
      utm: {},
      languages: ["de-DE"],
      device: "mobile",
      saveData: false,
      geo: pointAtDistance(MADRID, 900),
      now: "2026-09-29T18:30:00Z", // 20:30 in Madrid (CEST)
      consent: false,
    };
    const situation = deriveSituation(envelope, rules);
    expect(situation).toMatchObject({
      visitor: "tourist",
      mealWindow: "dinner",
      openState: "open",
      language: "german",
    });
    assertSituation(situation, spec);
    const text = JSON.stringify(situation);
    expect(text).not.toMatch(/\d/); // no distance, coordinates or timestamps
    expect(text).not.toContain("Deutsch");
  });

  it("detects closing-soon and closed", () => {
    const at = (iso: string) =>
      deriveSituation(
        { utm: {}, languages: [], device: "desktop", saveData: false, now: iso, consent: false },
        rules,
      );
    expect(at("2026-09-29T20:30:00Z").openState).toBe("closing-soon"); // 22:30
    expect(at("2026-09-29T21:40:00Z")).toMatchObject({ openState: "closed", mealWindow: "late" }); // 23:40
    expect(at("2026-09-29T11:00:00Z")).toMatchObject({ openState: "open", mealWindow: "lunch" }); // 13:00
  });
});

describe("situation hash (task 4.3)", () => {
  it("is stable and sensitive to every bucket", () => {
    const a = { arrival: "visual", device: "mobile" };
    expect(situationHash(a)).toBe(situationHash({ device: "mobile", arrival: "visual" }));
    expect(situationHash(a)).not.toBe(situationHash({ ...a, device: "desktop" }));
  });
});

describe("lab fixture override (task 4.4)", () => {
  const fixture: ContextEnvelope = {
    src: "instagram",
    utm: {},
    languages: ["en"],
    device: "mobile",
    saveData: false,
    now: "2026-09-29T18:30:00Z",
    consent: false,
  };
  const request = {
    url: "https://casa.example/?w4_ctx=tourist-insta",
    headers: { "user-agent": "curl" },
  };

  it("uses the fixture in lab mode", () => {
    const ctx = resolveContext(request, { labMode: true, fixtures: { "tourist-insta": fixture } });
    expect(ctx.source).toBe("fixture");
    expect(ctx.envelope).toBe(fixture);
  });

  it("ignores the parameter outside lab mode", () => {
    const ctx = resolveContext(request, { labMode: false, fixtures: { "tourist-insta": fixture } });
    expect(ctx.source).toBe("request");
    expect(ctx.envelope.src).toBeUndefined();
  });
});

describe("visit cookie consent (task 4.5)", () => {
  it("neither reads nor sets the cookie without consent", () => {
    const result = collectEnvelope({ url: "/", headers: { cookie: "w4_visit=9.20000" } });
    expect(result.envelope.visit).toBeUndefined();
    expect(result.setCookie).toBeUndefined();
    expect(deriveSituation(result.envelope, rules).familiarity).toBe("unknown");
  });

  it("counts visits with consent", () => {
    const first = collectEnvelope({ url: "/", headers: { cookie: `${CONSENT_COOKIE}=1` } });
    expect(deriveSituation(first.envelope, rules).familiarity).toBe("new");
    expect(first.setCookie).toMatch(/^w4_visit=1\./);
    const sixth = collectEnvelope({
      url: "/",
      headers: { cookie: `${CONSENT_COOKIE}=1; w4_visit=5.20000` },
    });
    expect(deriveSituation(sixth.envelope, rules).familiarity).toBe("regular");
  });
});

describe("hotel and booking referrers", () => {
  it("classifies booking sites as evaluating", () => {
    const arrival = (referer: string) =>
      deriveSituation(collectEnvelope({ url: "/", headers: { referer } }).envelope, CORE_RULES)
        .arrival;
    expect(arrival("https://www.booking.com/hotel/pt/casa-ribeira.html")).toBe("evaluating");
    expect(arrival("https://www.expedia.com/Porto-Hotels")).toBe("evaluating");
  });
});

describe("composable venue rules (v1 1.1)", () => {
  const env = (now: string, km?: number): ContextEnvelope => ({
    utm: {},
    languages: [],
    device: "mobile",
    saveData: false,
    consent: false,
    now,
    ...(km === undefined ? {} : { geo: pointAtDistance(MADRID, km) }),
  });

  it("distance alone yields only the visitor label", () => {
    const s = deriveSituation(env("2026-09-29T11:00:00Z", 1), [distanceRule({ location: MADRID })]);
    expect(s).toEqual({ visitor: "nearby" });
    expect(
      deriveSituation(env("2026-09-29T11:00:00Z", 20), [
        distanceRule({ location: MADRID, localKm: 10, bucket: "guest" }),
      ]),
    ).toEqual({ guest: "tourist" });
  });

  it("venueRules equals its parts", () => {
    const at = env("2026-09-29T21:40:00Z", 900);
    const parts = [
      distanceRule({ location: venue.location }),
      mealWindowRule({ timezone: venue.timezone }),
      openingHoursRule({ timezone: venue.timezone, hours: venue.hours }),
    ];
    expect(deriveSituation(at, venueRules(venue))).toEqual(deriveSituation(at, parts));
  });

  it("day part in venue local time", () => {
    const rule = [dayPartRule({ timezone: "Europe/Lisbon" })];
    const spec = DAY_PART_BUCKET;
    const at = (now: string) => deriveSituation(env(now), rule);
    expect(at("2026-10-02T07:30:00Z")).toEqual({ dayPart: "morning" }); // 08:30 WEST
    expect(at("2026-10-02T12:00:00Z")).toEqual({ dayPart: "afternoon" });
    expect(at("2026-10-02T19:00:00Z")).toEqual({ dayPart: "evening" });
    expect(at("2026-10-02T23:30:00Z")).toEqual({ dayPart: "night" });
    assertSituation(at("2026-10-02T07:30:00Z"), spec);
  });
});

describe("first-party enrichment (v1 1.3)", () => {
  const request = { url: "https://hotel.example/?booking=AB12", headers: {} };
  const enrich = (e: ContextEnvelope, r: { url: string }) => {
    const code = new URL(r.url).searchParams.get("booking");
    return code === "AB12" ? { ...e, firstParty: { arrival: "2026-10-02" } } : e;
  };

  it("adds first-party facts to real requests", () => {
    const ctx = resolveContext(request, { labMode: false, enrich });
    expect(ctx.source).toBe("request");
    expect(ctx.envelope.firstParty).toEqual({ arrival: "2026-10-02" });
  });

  it("never enriches fixtures or lab envelopes", () => {
    let calls = 0;
    const counting = (e: ContextEnvelope) => {
      calls++;
      return e;
    };
    const fixture = collectEnvelope({ url: "/", headers: {} }).envelope;
    resolveContext(
      { url: "/?w4_ctx=f", headers: {} },
      { labMode: true, fixtures: { f: fixture }, enrich: counting },
    );
    resolveContext(request, { labMode: true, labEnvelope: fixture, enrich: counting });
    expect(calls).toBe(0);
  });
});
