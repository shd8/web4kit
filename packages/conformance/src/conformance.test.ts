import { describe, expect, it } from "vitest";
import { calibrateEntry, type Observation } from "./index";

const obs = (conf: number, correct: boolean): Observation => ({
  kind: "C.region",
  language: "english",
  confidence: conf,
  correct,
});

describe("calibration thresholds (task 11.3)", () => {
  it("finds a threshold for a separable kind", () => {
    const data = [
      ...Array.from({ length: 40 }, (_, i) => obs(0.6 + (i % 10) * 0.04, true)),
      ...Array.from({ length: 10 }, (_, i) => obs(0.1 + i * 0.03, false)),
    ];
    const entry = calibrateEntry(data, undefined)!;
    expect(entry.uncalibrated).toBe(false);
    expect(entry.acceptThreshold).toBeGreaterThan(0.3); // admits at most 5% accepted errors (2 of 42)
    expect(entry.acceptThreshold).toBeLessThanOrEqual(0.6);
    expect(entry.accuracy).toBeCloseTo(0.8, 5);
  });

  it("marks silent failure (wrong answers as confident as right ones) uncalibrated", () => {
    const data = Array.from({ length: 60 }, (_, i) => obs(0.9 + (i % 5) * 0.02, i % 2 === 0));
    const entry = calibrateEntry(data, undefined)!;
    expect(entry.uncalibrated).toBe(true);
    expect(entry.overlap).toBeGreaterThan(0.4);
  });

  it("omits entries with too few samples", () => {
    expect(calibrateEntry([obs(0.9, true), obs(0.8, true)], undefined)).toBeUndefined();
  });

  it("adds a margin when answers flip between repeats", () => {
    const data = [
      ...Array.from({ length: 40 }, () => obs(0.8, true)),
      ...Array.from({ length: 10 }, () => obs(0.3, false)),
    ];
    const stable = calibrateEntry(data, 0)!;
    const jittery = calibrateEntry(data, 0.2)!;
    expect(jittery.acceptThreshold).toBeCloseTo(stable.acceptThreshold + 0.05, 5);
    expect(jittery.flipRate).toBe(0.2);
  });
});
