import { describe, expect, it } from "vitest";
import { runForecast } from "./run";
import { syntheticSeries } from "@/lib/analytics/__fixtures__/series";
import type { DailyPoint } from "@/lib/analytics/series";

const GEN = "2026-06-01T00:00:00.000Z";
const short: DailyPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  total_adspend: 100 + i,
  clicks: 50,
  revenue: 200,
  conversions: 5,
  rowCount: 1,
}));

describe("runForecast — additive metric", () => {
  const out = runForecast({ metric: "revenue", points: syntheticSeries(), horizonDays: 7, generatedAt: GEN });

  it("produces a horizon of points with ordered, uncertainty-bearing bounds", () => {
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.result.points).toHaveLength(7);
    for (const p of out.result.points) {
      expect(p.lowerBound).toBeLessThanOrEqual(p.predicted);
      expect(p.upperBound).toBeGreaterThanOrEqual(p.predicted);
      expect(p.lowerBound).toBeGreaterThanOrEqual(0); // additive metric floored at 0
    }
    expect(out.result.modelName).toBeTruthy();
    expect(["low", "medium", "high"]).toContain(out.result.confidence);
    expect(out.result.warnings.join(" ")).toMatch(/does not guarantee/i);
  });

  it("forecast dates immediately follow the training range", () => {
    if (out.status !== "ok") return;
    expect(out.result.points[0].date > out.result.trainingEnd).toBe(true);
    expect(out.result.observationsUsed).toBe(149);
  });
});

describe("runForecast — insufficient history", () => {
  it("refuses to forecast and reports allowed horizons", () => {
    const out = runForecast({ metric: "revenue", points: short, horizonDays: 7, generatedAt: GEN });
    expect(out.status).toBe("insufficient");
    if (out.status !== "insufficient") return;
    expect(out.allowedHorizons).toEqual([]); // 30 obs < 42
  });
});

describe("runForecast — derived ratio is coherent with its components", () => {
  it("CPC forecast equals spend forecast ÷ clicks forecast", () => {
    const points = syntheticSeries();
    const spend = runForecast({ metric: "total_adspend", points, horizonDays: 7, generatedAt: GEN });
    const clicks = runForecast({ metric: "clicks", points, horizonDays: 7, generatedAt: GEN });
    const cpc = runForecast({ metric: "cpc", points, horizonDays: 7, generatedAt: GEN });
    expect(spend.status).toBe("ok");
    expect(clicks.status).toBe("ok");
    expect(cpc.status).toBe("ok");
    if (spend.status !== "ok" || clicks.status !== "ok" || cpc.status !== "ok") return;
    for (let i = 0; i < 7; i++) {
      const expected = spend.result.points[i].predicted / clicks.result.points[i].predicted;
      expect(cpc.result.points[i].predicted).toBeCloseTo(expected, 8);
    }
    expect(cpc.result.modelName.toLowerCase()).toContain("derived");
  });
});
