import { describe, expect, it } from "vitest";
import { comparableMetrics, metricDailySeries, momentum } from "./momentum";
import type { Table } from "./compute";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const col = (id: string, name: string, type: ParsedColumn["inferredType"]): ParsedColumn => ({
  id,
  name,
  originalHeader: null,
  sheetColumn: 0,
  inferredType: type,
  typeOverride: null,
  formula: null,
});
const date = (iso: string): CellValue => ({ raw: iso, normalized: iso, display: iso, formula: null, type: "date" });
const n = (v: number): CellValue => ({ raw: v, normalized: v, display: String(v), formula: null, type: "currency" });

// 4 daily rows so day (n=1) and its prior have full periods; week/month won't.
const columns = [col("d", "Date", "date"), col("r", "Revenue", "currency"), col("s", "Total Adspend", "currency"), col("c", "Conversions", "integer"), col("v", "ROAS", "decimal")];
const table: Table = {
  columns,
  rows: [
    { d: date("2026-07-01"), r: n(100), s: n(50), c: n(10), v: n(2) },
    { d: date("2026-07-02"), r: n(200), s: n(50), c: n(10), v: n(4) },
    { d: date("2026-07-03"), r: n(300), s: n(60), c: n(10), v: n(5) },
    { d: date("2026-07-04"), r: n(400), s: n(100), c: n(10), v: n(4) },
  ],
};

describe("comparableMetrics", () => {
  it("lists canonical metrics present, in display order", () => {
    expect(comparableMetrics(table)).toEqual(["Revenue", "Total Adspend", "Conversions", "ROAS"]);
  });
});

describe("momentum", () => {
  it("today vs yesterday: latest day vs the day before, with % change", () => {
    const day = momentum(table, "Revenue").find((c) => c.key === "day")!;
    expect(day.current).toBe(400); // 07-04
    expect(day.previous).toBe(300); // 07-03
    expect(day.delta).toBe(100);
    expect(day.pct).toBeCloseTo(100 / 300); // +33%
  });

  it("uses ratio-of-sums for ROAS, not an average of daily ratios", () => {
    // Last 2 days would be revenue 700 / spend 160 = 4.375× — but only n=1 has a prior period here.
    const day = momentum(table, "ROAS").find((c) => c.key === "day")!;
    expect(day.current).toBeCloseTo(400 / 100); // 07-04 ratio-of-sums over one day = 4×
    expect(day.previous).toBeCloseTo(300 / 60); // 07-03 = 5×
  });

  it("marks a period incomparable when there isn't a full prior window", () => {
    const week = momentum(table, "Revenue").find((c) => c.key === "week")!;
    expect(week.previous).toBeNull(); // only 4 rows, need 14 for 7v7
    expect(week.pct).toBeNull();
  });

  it("returns nothing for an unknown metric", () => {
    expect(momentum(table, "Nonexistent")).toEqual([]);
  });
});

describe("metricDailySeries", () => {
  it("returns the metric's daily values, chronological, capped at n", () => {
    expect(metricDailySeries(table, "Revenue")).toEqual([100, 200, 300, 400]);
    expect(metricDailySeries(table, "Revenue", 2)).toEqual([300, 400]);
    expect(metricDailySeries(table, "Nonexistent")).toEqual([]);
  });
});
