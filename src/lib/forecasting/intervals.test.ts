import { describe, expect, it } from "vitest";
import { residualIntervals } from "./intervals";

describe("residualIntervals", () => {
  it("derives per-step widths from residual quantiles and widens with horizon", () => {
    const r = residualIntervals([100, 100, 100], [
      [5, -5, 5, -5], // step 1 residuals → |r| = 5
      [10, -10, 10, -10], // step 2 → 10
      [20, -20, 20, -20], // step 3 → 20
    ], { level: 0.8, nonNegative: true });
    expect(r.lower[0]).toBeCloseTo(95, 6);
    expect(r.upper[0]).toBeCloseTo(105, 6);
    // widths must be non-decreasing (uncertainty grows)
    const w0 = r.upper[0] - r.lower[0];
    const w2 = r.upper[2] - r.lower[2];
    expect(w2).toBeGreaterThanOrEqual(w0);
    expect(r.level).toBe(0.8);
    expect(r.method).toContain("residual");
  });

  it("floors non-negative metrics at zero", () => {
    const r = residualIntervals([5], [[-100, 100]], { level: 0.8, nonNegative: true });
    expect(r.lower[0]).toBe(0);
  });

  it("carries the previous width forward when a step has no residuals", () => {
    const r = residualIntervals([100, 100], [[8, -8], []], { level: 0.8 });
    const w0 = r.upper[0] - r.lower[0];
    const w1 = r.upper[1] - r.lower[1];
    expect(w1).toBeGreaterThanOrEqual(w0); // no step-2 residuals → reuse/expand, never collapse
  });
});
