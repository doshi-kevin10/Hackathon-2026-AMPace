import { describe, expect, it } from "vitest";
import { mae, mase, rmse, smape, wape } from "./error-metrics";

const actual = [1, 2, 3];
const pred = [2, 2, 2];

describe("error metrics", () => {
  it("MAE", () => {
    expect(mae(actual, pred)).toBeCloseTo(2 / 3, 10); // (1+0+1)/3
    expect(mae([5], [5])).toBe(0);
  });
  it("RMSE", () => {
    expect(rmse(actual, pred)).toBeCloseTo(Math.sqrt(2 / 3), 10);
  });
  it("WAPE = Σ|a-p| / Σ|a| (robust near zero)", () => {
    expect(wape(actual, pred)).toBeCloseTo(2 / 6, 10);
    expect(wape([0, 0], [1, 1])).toBeNull(); // Σ|a| = 0
  });
  it("sMAPE in [0,2]", () => {
    expect(smape([2], [4])).toBeCloseTo(2 * 2 / (2 + 4), 10); // 0.6667
    expect(smape([0], [0])).toBe(0); // both zero → 0, no divide error
  });
  it("MASE scales MAE by a naive error scale; null when scale is 0", () => {
    expect(mase(actual, pred, 0.5)).toBeCloseTo((2 / 3) / 0.5, 10);
    expect(mase(actual, pred, 0)).toBeNull();
  });
  it("empty inputs → null", () => {
    expect(mae([], [])).toBeNull();
    expect(rmse([], [])).toBeNull();
  });
});
