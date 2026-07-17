import { describe, expect, it } from "vitest";
import {
  CANONICAL_FIELDS,
  CANONICAL_FIELD_IDS,
  formatFieldValue,
} from "./canonical-registry";
import { calcColumnPeriodValue, canonicalValue, metricPeriodValue, type PeriodTotals } from "./aggregate";

const totals: PeriodTotals = { total_adspend: 1000, clicks: 500, revenue: 3000, conversions: 50, rowCount: 14 };

describe("canonical registry", () => {
  it("has metadata for every field id and unique db columns", () => {
    expect(CANONICAL_FIELD_IDS.length).toBe(9);
    const cols = CANONICAL_FIELD_IDS.map((id) => CANONICAL_FIELDS[id].dbColumn);
    expect(new Set(cols).size).toBe(cols.length);
  });
  it("formats by field type", () => {
    expect(formatFieldValue("total_adspend", 1234.5)).toBe("$1,234.5");
    expect(formatFieldValue("cvr", 0.1)).toBe("10.00%");
    expect(formatFieldValue("clicks", 12.9)).toBe("13");
    expect(formatFieldValue("roas", null)).toBe("—");
  });
});

describe("ratio-of-sums aggregation", () => {
  it("additive fields return the sum", () => {
    expect(canonicalValue("total_adspend", totals)).toBe(1000);
    expect(canonicalValue("clicks", totals)).toBe(500);
  });
  it("CPC = adspend / clicks", () => {
    expect(canonicalValue("cpc", totals)).toBe(2);
  });
  it("ROAS = revenue / adspend", () => {
    expect(canonicalValue("roas", totals)).toBe(3);
  });
  it("CVR = conversions / clicks", () => {
    expect(canonicalValue("cvr", totals)).toBe(0.1);
  });
  it("zero denominator → null (never Infinity)", () => {
    const z: PeriodTotals = { total_adspend: 100, clicks: 0, revenue: 200, conversions: 0, rowCount: 1 };
    expect(canonicalValue("cpc", z)).toBeNull();
    expect(canonicalValue("cvr", z)).toBeNull();
  });
  it("null component → null", () => {
    const n: PeriodTotals = { total_adspend: null, clicks: 10, revenue: 100, conversions: 5, rowCount: 1 };
    expect(canonicalValue("cpc", n)).toBeNull();
  });
  it("is ratio-of-sums, not average-of-daily-ratios", () => {
    // Day1: spend 100 clicks 10 (CPC 10). Day2: spend 900 clicks 490 (CPC ~1.84).
    // Avg of daily CPC ≈ 5.92; ratio of sums = 1000/500 = 2.0. Must be 2.0.
    expect(canonicalValue("cpc", totals)).toBe(2);
  });
});

describe("calc column period aggregation", () => {
  const profit = { id: "c1", name: "Profit", formula: "[Revenue] - [Total Adspend]", format: "currency" as const };
  it("Profit = periodRevenue - periodAdspend (affine over sums)", () => {
    expect(calcColumnPeriodValue(profit, totals)).toBe(2000);
  });
  it("resolves via metricPeriodValue by calc id", () => {
    expect(metricPeriodValue({ source: "calculated", calculatedColumnId: "c1" }, totals, [profit])).toBe(2000);
    expect(metricPeriodValue({ source: "canonical", field: "roas" }, totals, [])).toBe(3);
  });
  it("unknown reference → null", () => {
    const bad = { id: "c2", name: "X", formula: "[Nope] * 2", format: "number" as const };
    expect(calcColumnPeriodValue(bad, totals)).toBeNull();
  });
});
