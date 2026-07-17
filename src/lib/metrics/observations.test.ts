import { describe, expect, it } from "vitest";
import { isZeroBaselineJump, observe } from "./observations";

describe("observe", () => {
  it("computes absolute and percent change", () => {
    const o = observe(85, 100);
    expect(o.absoluteChange).toBe(-15);
    expect(o.percentChange).toBeCloseTo(-0.15, 10);
  });
  it("null comparison → both changes null", () => {
    const o = observe(50, null);
    expect(o.absoluteChange).toBeNull();
    expect(o.percentChange).toBeNull();
  });
  it("null current → both changes null", () => {
    const o = observe(null, 50);
    expect(o.absoluteChange).toBeNull();
    expect(o.percentChange).toBeNull();
  });
  it("zero comparison, nonzero current → percentChange null (never Infinity), flagged", () => {
    const o = observe(10, 0);
    expect(o.percentChange).toBeNull();
    expect(o.absoluteChange).toBe(10);
    expect(isZeroBaselineJump(o)).toBe(true);
  });
  it("zero comparison and zero current → percentChange null, not flagged", () => {
    const o = observe(0, 0);
    expect(o.percentChange).toBeNull();
    expect(isZeroBaselineJump(o)).toBe(false);
  });
});
