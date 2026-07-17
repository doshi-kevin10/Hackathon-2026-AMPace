import { describe, expect, it } from "vitest";
import { backtest } from "./backtest";
import { naiveModel } from "./models";

describe("backtest — rolling origin, expanding window", () => {
  it("uses only data before each origin and scores against the held-out window", () => {
    const out = backtest(naiveModel, [1, 2, 3, 4, 5, 6], { horizon: 1, minTrain: 3 });
    // origins 3,4,5 → naive predicts 3,4,5 ; actuals 4,5,6
    expect(out.windows).toBe(3);
    expect(out.actuals).toEqual([4, 5, 6]);
    expect(out.predictions).toEqual([3, 4, 5]);
    expect(out.metrics.mae).toBeCloseTo(1, 10);
    expect(out.metrics.wape).toBeCloseTo(3 / 15, 10);
    expect(out.residualsByStep[0]).toEqual([1, 1, 1]);
  });

  it("handles multi-step horizons with residuals bucketed per step-ahead", () => {
    const out = backtest(naiveModel, [10, 10, 10, 10, 20, 30], { horizon: 2, minTrain: 3 });
    // origin 3: train[10,10,10]→[10,10] actual[10,20] resid[0,10]
    // origin 4: train[..10]→[10,10] actual[20,30] resid[10,20]
    expect(out.windows).toBe(2);
    expect(out.residualsByStep[0]).toEqual([0, 10]); // step-1 residuals
    expect(out.residualsByStep[1]).toEqual([10, 20]); // step-2 residuals
  });

  it("caps to the most recent maxWindows origins", () => {
    const out = backtest(naiveModel, [1, 2, 3, 4, 5, 6, 7, 8], { horizon: 1, minTrain: 3, maxWindows: 2 });
    expect(out.windows).toBe(2);
    expect(out.actuals).toEqual([7, 8]); // last two origins only
  });
});
