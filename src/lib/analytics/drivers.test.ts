import { describe, expect, it } from "vitest";
import { decomposeMetric } from "./drivers";
import type { PeriodTotals } from "@/lib/metrics/aggregate";

const totals = (total_adspend: number, clicks: number, revenue: number, conversions: number): PeriodTotals => ({
  total_adspend,
  clicks,
  revenue,
  conversions,
  rowCount: 1,
});

describe("decomposeMetric — revenue (Clicks × CVR × RevPerConv)", () => {
  const comparison = totals(1000, 100, 1000, 10); // CVR 0.1, RPC 100
  const current = totals(4000, 200, 6000, 30); // CVR 0.15, RPC 200
  const d = decomposeMetric("revenue", current, comparison);

  it("is exact (LMDI): contributions sum to the total change", () => {
    expect(d.method).toBe("exact_lmdi");
    expect(d.totalChange).toBe(5000);
    const sum = d.contributions.reduce((s, c) => s + (c.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(5000, 6);
  });

  it("attributes equal log-change factors equally (clicks & rev/conv both doubled)", () => {
    const byName = new Map(d.contributions.map((c) => [c.factor, c.contribution!]));
    expect(byName.get("Clicks")).toBeCloseTo(byName.get("Revenue per conversion")!, 6);
    for (const c of d.contributions) expect(c.contribution!).toBeGreaterThan(0);
  });
});

describe("decomposeMetric — roas (Revenue up, Spend down)", () => {
  const comparison = totals(1000, 100, 2000, 20); // ROAS 2.0
  const current = totals(2000, 100, 3000, 20); // ROAS 1.5
  const d = decomposeMetric("roas", current, comparison);

  it("splits the ROAS drop into revenue and spend contributions that sum exactly", () => {
    expect(d.method).toBe("exact_lmdi");
    expect(d.totalChange).toBeCloseTo(-0.5, 10);
    const sum = d.contributions.reduce((s, c) => s + (c.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(-0.5, 8);
    const spend = d.contributions.find((c) => c.factor === "Total Adspend")!;
    expect(spend.contribution!).toBeLessThan(0); // rising spend pushed ROAS down
  });
});

describe("decomposeMetric — degenerate period", () => {
  it("falls back to an approximate explanation (no exact math on non-positive values)", () => {
    // Last period had traffic but zero conversions/revenue → CVR0=0, RevPerConv0 undefined.
    const comparison = totals(500, 100, 0, 0);
    const current = totals(1000, 200, 2000, 20);
    const d = decomposeMetric("revenue", current, comparison);
    expect(d.method).toBe("approximate");
    expect(d.contributions.every((c) => c.contribution === null)).toBe(true);
    // Clicks doubled, so its % change is computable even though the exact split is not.
    expect(d.contributions.find((c) => c.factor === "Clicks")!.factorChangePct).toBeCloseTo(1, 10);
    expect(d.note).toBeTruthy();
  });
});
