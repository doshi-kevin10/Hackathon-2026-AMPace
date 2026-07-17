import { describe, expect, it } from "vitest";
import { buildAnalytics, buildCorrelation } from "./engine";
import type { DailySeries } from "@/lib/databricks/history";
import { syntheticSeries } from "./__fixtures__/series";

const series: DailySeries = {
  name: "excel_company_test",
  points: syntheticSeries(),
  duplicateDates: [],
  latestDate: syntheticSeries()[syntheticSeries().length - 1].date,
  rowCount: 149,
};

describe("buildAnalytics", () => {
  const bundle = buildAnalytics(series, { granularity: "day", metrics: ["revenue", "cpc"] }, "2026-07-01T00:00:00Z");

  it("returns bucketed series for the requested metrics", () => {
    expect(bundle.series.map((s) => s.field)).toEqual(["revenue", "cpc"]);
    expect(bundle.series[0].points.length).toBe(bundle.observations); // daily → one point per day
    expect(bundle.series[0].format).toBe("currency");
  });

  it("includes comparison, baseline, trends, anomalies, drivers, and data quality", () => {
    expect(bundle.comparison.metrics.length).toBeGreaterThan(0);
    expect(bundle.baseline.map((b) => b.field)).toEqual(["revenue", "cpc"]);
    expect(bundle.trends.map((t) => t.field)).toEqual(["revenue", "cpc"]);
    expect(bundle.anomalies.length).toBeGreaterThan(0); // fixture has an injected spike
    expect(bundle.drivers.map((d) => d.metric)).toEqual(["revenue", "conversions", "roas", "cpc"]);
    expect(bundle.dataQuality.observations).toBe(bundle.observations);
  });

  it("aggregates weekly buckets with fewer points than daily", () => {
    const weekly = buildAnalytics(series, { granularity: "week", metrics: ["revenue"] }, "2026-07-01T00:00:00Z");
    expect(weekly.series[0].points.length).toBeLessThan(bundle.series[0].points.length);
  });
});

describe("buildCorrelation", () => {
  it("correlates two metrics and returns scatter + caveat", () => {
    const c = buildCorrelation(series, { metricA: "total_adspend", metricB: "clicks" });
    expect(c.labelA).toBe("Total Adspend");
    expect(c.scatter.length).toBeGreaterThan(0);
    expect(c.warning.toLowerCase()).toContain("causation");
    expect(typeof c.sufficient).toBe("boolean");
  });
});
