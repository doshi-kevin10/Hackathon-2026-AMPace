import { describe, expect, it } from "vitest";
import { comparePeriods, resolveComparisonRange } from "./comparison";
import type { DailyPoint } from "./series";

const p = (date: string, a: number, c: number, r: number, cv: number): DailyPoint => ({
  date,
  total_adspend: a,
  clicks: c,
  revenue: r,
  conversions: cv,
  rowCount: 1,
});

describe("resolveComparisonRange", () => {
  const current = { from: "2026-01-15", to: "2026-01-28" }; // 14 days

  it("previous_period is the equal-length window immediately before", () => {
    expect(resolveComparisonRange(current, "previous_period")).toEqual({ from: "2026-01-01", to: "2026-01-14" });
  });
  it("previous_week shifts back 7 days", () => {
    expect(resolveComparisonRange(current, "previous_week")).toEqual({ from: "2026-01-08", to: "2026-01-21" });
  });
  it("previous_year shifts back one year", () => {
    expect(resolveComparisonRange(current, "previous_year")).toEqual({ from: "2025-01-15", to: "2025-01-28" });
  });
  it("previous_quarter shifts back three months", () => {
    expect(resolveComparisonRange(current, "previous_quarter")).toEqual({ from: "2025-10-15", to: "2025-10-28" });
  });
  it("custom returns the supplied range", () => {
    const custom = { from: "2025-06-01", to: "2025-06-14" };
    expect(resolveComparisonRange(current, "custom", custom)).toEqual(custom);
  });
});

describe("comparePeriods", () => {
  const points = [
    p("2026-01-01", 100, 50, 200, 5),
    p("2026-01-02", 100, 50, 200, 5), // comparison window
    p("2026-01-03", 200, 50, 100, 5),
    p("2026-01-04", 200, 50, 100, 5), // current window
  ];
  const result = comparePeriods(points, { from: "2026-01-03", to: "2026-01-04" }, "previous_period");
  const byField = new Map(result.metrics.map((m) => [m.field, m]));

  it("resolves the comparison window", () => {
    expect(result.comparison).toEqual({ from: "2026-01-01", to: "2026-01-02" });
  });

  it("uses ratio-of-sums and flags falling revenue as unfavorable", () => {
    const rev = byField.get("revenue")!;
    expect(rev.currentValue).toBe(200); // 100+100
    expect(rev.comparisonValue).toBe(400); // 200+200
    expect(rev.percentChange).toBeCloseTo(-0.5, 10);
    expect(rev.sentiment).toBe("unfavorable");
  });

  it("flags rising CPC as unfavorable (lower is better)", () => {
    const cpc = byField.get("cpc")!;
    expect(cpc.currentValue).toBeCloseTo(4, 10); // 400/100
    expect(cpc.comparisonValue).toBeCloseTo(2, 10); // 200/100
    expect(cpc.sentiment).toBe("unfavorable");
  });

  it("treats spend (context) and unchanged CVR as neutral", () => {
    expect(byField.get("total_adspend")!.sentiment).toBe("neutral");
    expect(byField.get("cvr")!.sentiment).toBe("neutral"); // 0.1 vs 0.1
  });

  it("handles a zero comparison baseline without ±Infinity", () => {
    const zeroPts = [p("2026-01-01", 0, 0, 0, 0), p("2026-01-02", 100, 50, 200, 5)];
    const r = comparePeriods(zeroPts, { from: "2026-01-02", to: "2026-01-02" }, "previous_period");
    const rev = new Map(r.metrics.map((m) => [m.field, m])).get("revenue")!;
    expect(rev.comparisonValue).toBe(0);
    expect(rev.percentChange).toBeNull(); // no Infinity
  });
});
