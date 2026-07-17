import { describe, expect, it } from "vitest";
import { assessDataQuality } from "./data-quality";
import type { DailyPoint } from "./series";
import { FIXTURE_MISSING_DATE, syntheticSeries } from "./__fixtures__/series";

const p = (date: string, adspend = 100, clicks = 50, revenue = 200, conversions = 5): DailyPoint => ({
  date,
  total_adspend: adspend,
  clicks,
  revenue,
  conversions,
  rowCount: 1,
});

const contiguous = (n: number, start = "2026-01-01"): DailyPoint[] => {
  const base = new Date(`${start}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => p(new Date(base + i * 86_400_000).toISOString().slice(0, 10)));
};

describe("assessDataQuality", () => {
  it("gives a clean, sufficient series a perfect score", () => {
    const r = assessDataQuality(contiguous(60));
    expect(r.score).toBe(100);
    expect(r.issues).toHaveLength(0);
    expect(r.missingDates).toEqual([]);
    expect(r.observations).toBe(60);
    expect(r.sufficientForForecast).toBe(true);
  });

  it("flags negative metric values as critical and blocks forecasting", () => {
    const pts = contiguous(60);
    pts[10].revenue = -5;
    const r = assessDataQuality(pts);
    expect(r.issues.some((i) => i.code === "negative_values" && i.severity === "critical")).toBe(true);
    expect(r.score).toBeLessThan(100);
    expect(r.sufficientForForecast).toBe(false);
  });

  it("detects missing calendar dates", () => {
    const pts = [p("2026-01-01"), p("2026-01-02"), p("2026-01-05")];
    const r = assessDataQuality(pts);
    expect(r.missingDates).toEqual(["2026-01-03", "2026-01-04"]);
    expect(r.issues.some((i) => i.code === "missing_dates")).toBe(true);
    expect(r.largestGapDays).toBe(2);
  });

  it("reports duplicate dates supplied from the raw layer", () => {
    const r = assessDataQuality(contiguous(60), { duplicateDates: ["2026-01-10"] });
    expect(r.duplicateDates).toEqual(["2026-01-10"]);
    expect(r.issues.some((i) => i.code === "duplicate_dates")).toBe(true);
  });

  it("marks too-short history as insufficient for forecasting", () => {
    const r = assessDataQuality(contiguous(10), { minForecastObservations: 42 });
    expect(r.sufficientForForecast).toBe(false);
    expect(r.issues.some((i) => i.code === "insufficient_history")).toBe(true);
  });

  it("computes staleness against an asOf date", () => {
    const pts = contiguous(60, "2026-01-01"); // latest = 2026-03-01
    const r = assessDataQuality(pts, { asOf: "2026-04-01", staleThresholdDays: 7 });
    expect(r.staleDays).toBe(31);
    expect(r.issues.some((i) => i.code === "stale_data")).toBe(true);
  });

  it("finds the injected gap in the synthetic fixture", () => {
    const r = assessDataQuality(syntheticSeries());
    expect(r.missingDates).toContain(FIXTURE_MISSING_DATE);
    expect(r.observations).toBe(149);
    expect(r.sufficientForForecast).toBe(true); // one gap doesn't kill a 149-day series
  });
});
