import { describe, expect, it } from "vitest";
import { computeBaseline } from "./baseline";
import type { DailyPoint } from "./series";

const p = (date: string, a: number | null, c = 50, r = 200, cv = 5): DailyPoint => ({
  date,
  total_adspend: a,
  clicks: c,
  revenue: r,
  conversions: cv,
  rowCount: 1,
});

describe("computeBaseline", () => {
  const points = [
    p("2026-01-01", 10),
    p("2026-01-02", 20),
    p("2026-01-03", 30),
    p("2026-01-04", 40),
  ];
  const b = computeBaseline(points, "total_adspend", [2]);

  it("computes whole-series descriptive stats", () => {
    expect(b.mean).toBe(25);
    expect(b.median).toBe(25);
    expect(b.min).toBe(10);
    expect(b.max).toBe(40);
    expect(b.stddev).toBeCloseTo(12.9099, 4);
    expect(b.observations).toBe(4);
    expect(b.missing).toBe(0);
  });

  it("reports percentiles", () => {
    expect(b.p25).toBeCloseTo(17.5, 6);
    expect(b.p75).toBeCloseTo(32.5, 6);
  });

  it("computes the recent moving average/median for each requested window", () => {
    expect(b.rolling).toEqual([{ window: 2, movingAverage: 35, movingMedian: 35 }]);
  });

  it("reports period-over-period growth and trend direction", () => {
    expect(b.periodOverPeriodGrowth).toBeCloseTo(1 / 3, 6); // (40-30)/30
    expect(b.trendDirection).toBe("increasing");
  });

  it("counts missing observations", () => {
    const withGap = computeBaseline([p("2026-01-01", 10), p("2026-01-02", null), p("2026-01-03", 30)], "total_adspend", [7]);
    expect(withGap.observations).toBe(2);
    expect(withGap.missing).toBe(1);
  });

  it("uses ratio-of-sums for a ratio field's per-day value", () => {
    // CPC per day = adspend/clicks; here 10/50=0.2 and 40/50=0.8
    const cpc = computeBaseline([p("2026-01-01", 10, 50), p("2026-01-02", 40, 50)], "cpc", [7]);
    expect(cpc.min).toBeCloseTo(0.2, 10);
    expect(cpc.max).toBeCloseTo(0.8, 10);
  });
});
