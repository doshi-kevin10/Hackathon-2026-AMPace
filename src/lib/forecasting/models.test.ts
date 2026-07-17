import { describe, expect, it } from "vitest";
import {
  holtModel,
  holtWintersModel,
  linearTrendModel,
  movingAverageModel,
  naiveModel,
  seasonalNaiveModel,
  sesModel,
} from "./models";

describe("naive", () => {
  it("repeats the last value", () => {
    expect(naiveModel.forecast([3, 7, 5], 3)).toEqual([5, 5, 5]);
  });
});

describe("seasonal naive", () => {
  it("repeats the last full season", () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 10, 20, 30, 40, 50, 60, 70]; // last 7 = 10..70
    expect(seasonalNaiveModel.forecast(vals, 9, { seasonPeriod: 7 })).toEqual([10, 20, 30, 40, 50, 60, 70, 10, 20]);
  });
});

describe("moving average", () => {
  it("holds the mean of the last 7 observations flat", () => {
    // last 7 = [2,2,2,2,2,2,9] → mean 3
    expect(movingAverageModel.forecast([2, 2, 2, 2, 2, 2, 2, 9], 2)).toEqual([3, 3]);
  });
});

describe("linear trend", () => {
  it("continues the fitted line", () => {
    // y = x + 1 (x=0..4 → 1..5); next x=5,6 → 6,7
    const out = linearTrendModel.forecast([1, 2, 3, 4, 5], 2);
    expect(out[0]).toBeCloseTo(6, 8);
    expect(out[1]).toBeCloseTo(7, 8);
  });
});

describe("SES", () => {
  it("returns a flat forecast equal to a constant series", () => {
    expect(sesModel.forecast([5, 5, 5, 5, 5], 3)).toEqual([5, 5, 5]);
  });
  it("is flat and does not exceed the observed range", () => {
    const out = sesModel.forecast([1, 2, 3, 4, 5, 6, 7, 8], 3);
    expect(new Set(out.map((v) => Math.round(v * 1e6))).size).toBe(1); // flat
    expect(out[0]).toBeLessThanOrEqual(8);
    expect(out[0]).toBeGreaterThanOrEqual(1);
  });
});

describe("Holt", () => {
  it("projects an upward trend forward", () => {
    const out = holtModel.forecast([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(out[0]).toBeGreaterThan(10); // continues rising
    expect(out[2]).toBeGreaterThan(out[0]); // and keeps rising
  });
});

describe("Holt-Winters", () => {
  it("reproduces the seasonal shape of a clean repeating pattern", () => {
    const season = [10, 40, 20, 30];
    const vals = Array.from({ length: 24 }, (_, i) => season[i % 4]);
    const out = holtWintersModel.forecast(vals, 4, { seasonPeriod: 4 });
    // peak of the season (index 1) should be the largest of the 4-step forecast
    const maxIdx = out.indexOf(Math.max(...out));
    expect(maxIdx).toBe(1);
    out.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});
