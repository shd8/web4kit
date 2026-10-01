import type { ContextEnvelope } from "@web4kit/context";
import { describe, expect, it } from "vitest";
import {
  ARRIVALS,
  getArrival,
  getClock,
  getDistance,
  getVisits,
  setArrival,
  setClock,
  setDistance,
  setVisits,
  VISITS,
} from "./index";

const base: ContextEnvelope = {
  utm: {},
  languages: ["en-GB"],
  device: "mobile",
  saveData: false,
  now: "2026-10-01T12:00:00Z",
  consent: false,
};
const VENUE = { lat: 40.4168, lng: -3.7038 };

describe("demo controls round-trip through the envelope", () => {
  it("arrival", () => {
    for (const { id } of ARRIVALS) expect(getArrival(setArrival(base, id))).toBe(id);
  });

  it("clock in the venue's time zone", () => {
    const e = setClock(base, "Europe/Madrid", 5, 23 * 60 + 40);
    expect(getClock(e, "Europe/Madrid")).toMatchObject({ day: 5, minutes: 23 * 60 + 40 });
  });

  it("distance", () => {
    for (const km of [0.3, 12, 900]) {
      const d = getDistance(setDistance(base, VENUE, km), VENUE)!;
      expect(Math.abs(d - km) / km).toBeLessThan(0.01);
    }
    expect(getDistance(base, VENUE)).toBeUndefined();
  });

  it("visits", () => {
    for (const { id } of VISITS) expect(getVisits(setVisits(base, id))).toBe(id);
  });
});
