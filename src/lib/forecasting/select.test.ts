import { describe, expect, it } from "vitest";
import { holtWintersModel, linearTrendModel, naiveModel, seasonalNaiveModel } from "./models";
import { selectModel } from "./select";

describe("selectModel", () => {
  it("prefers the model with the lowest backtest WAPE", () => {
    const values = Array.from({ length: 40 }, (_, i) => 10 + i); // clean upward line
    const res = selectModel([naiveModel, linearTrendModel], values, { horizon: 3, minTrain: 20 });
    expect(res.selected!.name).toBe("linear_trend"); // continues the line ≈ perfectly
    expect(res.selected!.metrics!.wape!).toBeLessThan(0.01);
    expect(res.candidates.every((c) => c.eligible)).toBe(true);
  });

  it("marks a seasonal model ineligible when there isn't enough history", () => {
    const values = Array.from({ length: 20 }, (_, i) => i); // < 2 seasons at period 7... enough count but check season
    const res = selectModel([naiveModel, holtWintersModel], values, { horizon: 7, minTrain: 10, seasonPeriod: 14 });
    const hw = res.candidates.find((c) => c.name === "holt_winters")!;
    expect(hw.eligible).toBe(false);
    expect(hw.reason).toBeTruthy();
  });

  it("returns null selection when no model is eligible", () => {
    const res = selectModel([seasonalNaiveModel], [1, 2, 3], { horizon: 1, minTrain: 2 });
    expect(res.selected).toBeNull();
  });
});
