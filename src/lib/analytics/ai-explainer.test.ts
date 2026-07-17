import { describe, expect, it } from "vitest";
import { buildExplanationInput, explainAnalyticsMock, DISCLAIMER } from "./ai-explainer";
import type { AnalyticsBundle } from "./engine";
import { buildAnalytics } from "./engine";
import type { DailySeries } from "@/lib/databricks/history";
import { syntheticSeries } from "./__fixtures__/series";

const series: DailySeries = {
  name: "excel_company_test",
  points: syntheticSeries(),
  duplicateDates: [],
  latestDate: syntheticSeries()[syntheticSeries().length - 1].date,
  rowCount: 149,
};
const bundle: AnalyticsBundle = buildAnalytics(series, { granularity: "day", metrics: ["revenue", "roas", "cpc"] }, "2026-07-01T00:00:00Z");

describe("buildExplanationInput", () => {
  it("extracts only structured deterministic facts (no prose, no invented numbers)", () => {
    const input = buildExplanationInput(bundle);
    expect(input.company).toBe("excel_company_test");
    expect(input.keyMetrics.length).toBeGreaterThan(0);
    // every number comes straight from the bundle's comparison
    const rev = input.keyMetrics.find((m) => m.field === "revenue")!;
    const bundleRev = bundle.comparison.metrics.find((m) => m.field === "revenue")!;
    expect(rev.current).toBe(bundleRev.currentValue);
    expect(rev.changePct).toBe(bundleRev.percentChange);
    expect(input.dataQuality.score).toBe(bundle.dataQuality.score);
  });
});

describe("explainAnalyticsMock", () => {
  const input = buildExplanationInput(bundle);
  const out = explainAnalyticsMock(input);

  it("is deterministic and echoes the provided data-quality score (never invents it)", () => {
    expect(out.mode).toBe("mock");
    expect(out).toEqual(explainAnalyticsMock(input)); // deterministic
    expect(out.summary).toContain(String(bundle.dataQuality.score));
  });

  it("always carries the no-guarantee / no-causation disclaimer", () => {
    expect(out.disclaimer).toBe(DISCLAIMER);
    expect(out.disclaimer.toLowerCase()).toContain("does not guarantee");
    expect(out.disclaimer.toLowerCase()).toContain("causation");
  });
});
