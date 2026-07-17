import { describe, expect, it } from "vitest";
import { analyzeTrend, linearRegression } from "./trend";

describe("linearRegression", () => {
  it("fits a perfect line and skips nulls (x = original index)", () => {
    expect(linearRegression([1, 2, 3, 4, 5])).toMatchObject({ slope: 1, intercept: 1 });
    expect(linearRegression([1, null, 3])).toMatchObject({ slope: 1, intercept: 1 });
  });
  it("returns null slope with fewer than 2 points", () => {
    expect(linearRegression([5]).slope).toBeNull();
  });
});

describe("analyzeTrend", () => {
  it("labels a clear rise as increasing with r²=1", () => {
    const t = analyzeTrend([1, 2, 3, 4, 5]);
    expect(t.slope).toBeCloseTo(1, 10);
    expect(t.direction).toBe("increasing");
    expect(t.rSquared).toBeCloseTo(1, 10);
    expect(t.percentChange).toBeCloseTo(4, 10); // (5-1)/1
  });

  it("labels a clear fall as decreasing", () => {
    expect(analyzeTrend([5, 4, 3, 2, 1]).direction).toBe("decreasing");
  });

  it("labels small fluctuations as flat (below threshold)", () => {
    expect(analyzeTrend([100, 101, 100, 101, 100]).direction).toBe("flat");
    expect(analyzeTrend([3, 3, 3, 3]).direction).toBe("flat");
  });

  it("respects a configurable flat threshold", () => {
    // ~20% total change is 'increasing' by default but 'flat' with a 50% threshold
    expect(analyzeTrend([100, 105, 110, 115, 120]).direction).toBe("increasing");
    expect(analyzeTrend([100, 105, 110, 115, 120], { flatThreshold: 0.5 }).direction).toBe("flat");
  });

  it("computes short and long moving averages", () => {
    const t = analyzeTrend([1, 2, 3, 4, 5, 6], { shortWindow: 2, longWindow: 4 });
    expect(t.shortMA).toBe(5.5); // mean(5,6)
    expect(t.longMA).toBe(4.5); // mean(3,4,5,6)
  });

  it("detects acceleration by local slope magnitude", () => {
    expect(analyzeTrend([1, 1, 1, 5, 10]).acceleration).toBe("accelerating");
    expect(analyzeTrend([1, 5, 9, 10, 11]).acceleration).toBe("decelerating");
    expect(analyzeTrend([1, 2, 3, 4, 5]).acceleration).toBe("steady");
  });
});
