import { describe, expect, it } from "vitest";
import {
  coefficientOfVariation,
  finite,
  max,
  mean,
  median,
  min,
  percentile,
  rollingMean,
  rollingMedian,
  stddev,
  volatility,
} from "./statistics";

describe("finite", () => {
  it("drops null, NaN and non-finite values", () => {
    expect(finite([1, null, 2, NaN, Infinity, 3])).toEqual([1, 2, 3]);
  });
});

describe("centre + spread", () => {
  it("mean/median/min/max ignore nulls", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([2, null, 6])).toBe(4);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3])).toBe(2);
    expect(min([3, 1, 2])).toBe(1);
    expect(max([3, 1, 2])).toBe(3);
  });

  it("stddev is the sample (n-1) standard deviation", () => {
    expect(stddev([2, 4, 6])).toBe(2);
    expect(stddev([5])).toBeNull(); // needs >= 2
    expect(stddev([])).toBeNull();
  });

  it("empty inputs return null", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(min([])).toBeNull();
  });
});

describe("percentile (linear interpolation)", () => {
  it("interpolates like numpy 'linear'", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 100)).toBe(4);
    expect(percentile([1, 2, 3, 4], 25)).toBe(1.75);
  });
  it("null for empty", () => {
    expect(percentile([], 50)).toBeNull();
  });
});

describe("rolling windows (trailing, aligned to input)", () => {
  it("rollingMean fills null until the window is satisfied", () => {
    expect(rollingMean([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("rollingMedian likewise", () => {
    expect(rollingMedian([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe("volatility", () => {
  it("is the sample stddev of consecutive percentage changes", () => {
    expect(volatility([100, 110, 99])).toBeCloseTo(0.1414213, 6);
    expect(volatility([100])).toBeNull();
  });
  it("coefficientOfVariation = stddev / |mean|", () => {
    expect(coefficientOfVariation([2, 4, 6])).toBe(0.5); // 2 / 4
  });
});
