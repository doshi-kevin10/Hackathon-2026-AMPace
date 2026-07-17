import { describe, expect, it } from "vitest";
import { buildForecast } from "./forecast";
import type { Table } from "./compute";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const col = (id: string, name: string, type: ParsedColumn["inferredType"]): ParsedColumn => ({
  id, name, originalHeader: null, sheetColumn: 0, inferredType: type, typeOverride: null, formula: null,
});
const date = (iso: string): CellValue => ({ raw: iso, normalized: iso, display: iso, formula: null, type: "date" });
const n = (v: number): CellValue => ({ raw: v, normalized: v, display: String(v), formula: null, type: "currency" });

const dayISO = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);

// 30 days of gently rising daily revenue.
const columns = [col("d", "Date", "date"), col("r", "Revenue", "currency")];
const table: Table = {
  columns,
  rows: Array.from({ length: 30 }, (_, i) => ({ d: date(dayISO(i)), r: n(100 + i * 5) })),
};

describe("buildForecast", () => {
  it("returns history + a 14-day projection with matching label/series lengths", () => {
    const fc = buildForecast(table, "Revenue", 14, 20)!;
    expect(fc).not.toBeNull();
    expect(fc.horizon).toBe(14);
    expect(fc.labels).toHaveLength(20 + 14); // shown history + horizon
    expect(fc.actual).toHaveLength(34);
    expect(fc.forecast).toHaveLength(34);
    // Actuals fill history then go null; forecast is null in history then filled.
    expect(fc.actual[fc.actual.length - 1]).toBeNull();
    expect(fc.forecast[fc.forecast.length - 1]).not.toBeNull();
    expect(fc.actual[0]).not.toBeNull();
  });

  it("projects an additive metric as a horizon sum and compares to the prior window", () => {
    const fc = buildForecast(table, "Revenue", 14)!;
    expect(fc.additive).toBe(true);
    expect(fc.projected).toBeGreaterThan(0);
    expect(fc.baseline).toBeGreaterThan(0);
    // Rising series → next 14 days should project above the prior 14.
    expect(fc.pct).toBeGreaterThan(0);
  });

  it("needs at least two weeks of history", () => {
    const short: Table = { columns, rows: table.rows.slice(0, 10) };
    expect(buildForecast(short, "Revenue")).toBeNull();
  });

  it("returns null for an unknown metric", () => {
    expect(buildForecast(table, "Nonexistent")).toBeNull();
  });
});
