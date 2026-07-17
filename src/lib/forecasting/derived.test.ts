import { describe, expect, it } from "vitest";
import { deriveRatioForecast } from "./derived";
import type { ForecastPoint } from "./types";

const pt = (date: string, predicted: number, lowerBound: number, upperBound: number): ForecastPoint => ({
  date,
  predicted,
  lowerBound,
  upperBound,
});

describe("deriveRatioForecast", () => {
  it("computes CPC = spend/clicks with bounds propagated (num↑, den↓ widen the ratio)", () => {
    const spend = [pt("2026-02-01", 400, 380, 420), pt("2026-02-02", 400, 360, 440)];
    const clicks = [pt("2026-02-01", 100, 90, 110), pt("2026-02-02", 100, 80, 120)];
    const { points } = deriveRatioForecast(spend, clicks);
    expect(points[0].predicted).toBeCloseTo(4, 10);
    expect(points[0].lowerBound).toBeCloseTo(380 / 110, 10); // num.lower / den.upper
    expect(points[0].upperBound).toBeCloseTo(420 / 90, 10); // num.upper / den.lower
    expect(points[0].lowerBound).toBeLessThan(points[0].predicted);
    expect(points[0].upperBound).toBeGreaterThan(points[0].predicted);
  });

  it("guards a zero denominator (predicted 0, warned) rather than emitting Infinity", () => {
    const num = [pt("2026-02-01", 100, 90, 110)];
    const den = [pt("2026-02-01", 0, 0, 0)];
    const { points, warnings } = deriveRatioForecast(num, den);
    expect(Number.isFinite(points[0].predicted)).toBe(true);
    expect(points[0].predicted).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
