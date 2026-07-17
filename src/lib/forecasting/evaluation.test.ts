import { describe, expect, it } from "vitest";
import { evaluateForecast } from "./evaluation";
import type { DailyPoint } from "@/lib/analytics/series";
import type { StoredForecast } from "./store";

const stored: StoredForecast = {
  id: "revenue_7d_x",
  company: "excel_company_aa",
  metric: "revenue",
  horizonDays: 7,
  dataVersion: "v1",
  createdAt: "2026-06-01T00:00:00.000Z",
  result: {
    metric: "revenue",
    horizonDays: 7,
    modelName: "holt",
    generatedAt: "2026-06-01T00:00:00.000Z",
    trainingStart: "2026-01-01",
    trainingEnd: "2026-05-31",
    observationsUsed: 150,
    backtestMetrics: { mae: null, rmse: null, wape: null, smape: null, mase: null },
    points: [
      { date: "2026-06-01", predicted: 100, lowerBound: 90, upperBound: 110 },
      { date: "2026-06-02", predicted: 110, lowerBound: 100, upperBound: 120 },
      { date: "2026-06-03", predicted: 120, lowerBound: 110, upperBound: 130 }, // no actual yet
    ],
    intervalMethod: "residual-quantile-80",
    intervalLevel: 0.8,
    confidence: "medium",
    warnings: [],
  },
};

const actual = (date: string, revenue: number): DailyPoint => ({
  date,
  total_adspend: 0,
  clicks: 0,
  revenue,
  conversions: 0,
  rowCount: 1,
});

describe("evaluateForecast", () => {
  const ev = evaluateForecast(stored, [actual("2026-06-01", 105), actual("2026-06-02", 130)]);

  it("matches each forecast point to a later actual and scores it", () => {
    expect(ev.evaluated).toBe(2); // 3rd point has no actual yet
    const p1 = ev.points.find((p) => p.targetDate === "2026-06-01")!;
    expect(p1.actual).toBe(105);
    expect(p1.absError).toBe(5);
    expect(p1.withinInterval).toBe(true);
    const p2 = ev.points.find((p) => p.targetDate === "2026-06-02")!;
    expect(p2.withinInterval).toBe(false); // 130 > upper 120
  });

  it("aggregates error and interval coverage", () => {
    expect(ev.mae).toBeCloseTo(12.5, 6); // (5 + 20)/2
    expect(ev.wape).toBeCloseTo(25 / 235, 6);
    expect(ev.coverage).toBeCloseTo(0.5, 6); // 1 of 2 inside interval
  });

  it("returns zero-evaluated when no actuals overlap", () => {
    const none = evaluateForecast(stored, [actual("2027-01-01", 999)]);
    expect(none.evaluated).toBe(0);
    expect(none.mae).toBeNull();
  });
});
