import { describe, expect, it } from "vitest";
import { analyzeCorrelation, pearson, spearman } from "./correlation";

describe("pearson", () => {
  it("is +1 for a perfectly increasing linear relationship", () => {
    expect(pearson([1, 2, 3, 4, 5, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16], 3)).toBeCloseTo(1, 10);
  });
  it("is -1 for a perfectly decreasing relationship", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2], 3)).toBeCloseTo(-1, 10);
  });
  it("is null when a series has no variance", () => {
    expect(pearson([1, 2, 3], [5, 5, 5], 3)).toBeNull();
  });
});

describe("spearman", () => {
  it("is +1 for any monotonic increasing relationship (nonlinear ok)", () => {
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 64], 3)).toBeCloseTo(1, 10);
  });
});

describe("analyzeCorrelation", () => {
  it("refuses to report a coefficient below the minimum sample size", () => {
    const r = analyzeCorrelation([1, 2, 3], [2, 4, 6], { minSamples: 8 });
    expect(r.sufficient).toBe(false);
    expect(r.pearson).toBeNull();
    expect(r.spearman).toBeNull();
  });

  it("always includes a not-causation caveat", () => {
    const r = analyzeCorrelation([1, 2, 3, 4, 5, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16], { minSamples: 3 });
    expect(r.pearson).toBeCloseTo(1, 10);
    expect(r.warning.toLowerCase()).toContain("causation");
  });

  it("finds the lag at which one series leads the other", () => {
    // Zig-zag-with-trend: non-monotonic + non-symmetric, so a single lag aligns perfectly.
    const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 13];
    const xs = base;
    const ys: (number | null)[] = base.map((_, i) => (i >= 2 ? base[i - 2] : null)); // xs leads ys by 2
    const r = analyzeCorrelation(xs, ys, { minSamples: 5, maxLag: 4 });
    expect(r.bestLag).not.toBeNull();
    expect(r.bestLag!.lag).toBe(2);
    expect(r.bestLag!.r).toBeCloseTo(1, 8);
  });
});
