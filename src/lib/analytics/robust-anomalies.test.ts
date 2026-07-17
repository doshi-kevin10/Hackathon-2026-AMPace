import { describe, expect, it } from "vitest";
import { detectRobustAnomalies, robustZScores } from "./robust-anomalies";
import type { DailyPoint } from "./series";
import { FIXTURE_ANOMALY_DATE, syntheticSeries } from "./__fixtures__/series";

const p = (date: string, a: number | null, c = 50, r = 200, cv = 5): DailyPoint => ({
  date,
  total_adspend: a,
  clicks: c,
  revenue: r,
  conversions: cv,
  rowCount: 1,
});

const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

describe("robustZScores", () => {
  it("uses median + MAD so a single outlier does not inflate the scale", () => {
    const z = robustZScores([0, 1, -1, 0, 48, -1]);
    expect(z[4]).toBeGreaterThan(10); // the 48 is a strong outlier
    expect(Math.abs(z[0]!)).toBeLessThan(3.5);
  });
});

describe("detectRobustAnomalies", () => {
  it("isolates a spike against a rolling baseline (not the global mean)", () => {
    const vals = [10, 12, 11, 13, 10, 12, 60, 11];
    const points = vals.map((v, i) => p(day(i), v));
    const events = detectRobustAnomalies(points, { fields: ["total_adspend"], window: 3, threshold: 3.5 });
    const spike = events.find((e) => e.field === "total_adspend" && e.value === 60);
    expect(spike).toBeDefined();
    expect(spike!.date).toBe(day(6));
    expect(spike!.severity).toBe("high");
    expect(spike!.expectedHigh!).toBeLessThan(60);
    expect(spike!.deviation).toBeGreaterThan(5);
  });

  it("flags an unexpected zero where the metric is normally positive", () => {
    const points = [p(day(0), 200), p(day(1), 210), p(day(2), 0), p(day(3), 205), p(day(4), 198)].map((pt, i) => ({
      ...pt,
      total_adspend: [200, 210, 0, 205, 198][i],
    }));
    const events = detectRobustAnomalies(points, { fields: ["total_adspend"], window: 3, threshold: 3.5 });
    const zero = events.find((e) => e.method === "zero_value");
    expect(zero).toBeDefined();
    expect(zero!.value).toBe(0);
  });

  it("does not flood: a clean linear ramp produces no anomalies", () => {
    const points = Array.from({ length: 30 }, (_, i) => p(day(i), 100 + i));
    const events = detectRobustAnomalies(points, { fields: ["total_adspend"], window: 7 });
    expect(events).toHaveLength(0);
  });

  it("finds the injected spend spike in the synthetic fixture", () => {
    const events = detectRobustAnomalies(syntheticSeries(), { fields: ["total_adspend"] });
    const dates = events.filter((e) => e.field === "total_adspend").map((e) => e.date);
    expect(dates).toContain(FIXTURE_ANOMALY_DATE);
  });
});
