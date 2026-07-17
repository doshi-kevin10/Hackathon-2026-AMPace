import { describe, expect, it } from "vitest";
import { byDayOfWeek, timeSeries, topRows } from "./compute";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const col = (id: string, name: string): ParsedColumn => ({
  id, name, originalHeader: null, sheetColumn: -1, inferredType: "decimal", typeOverride: null, formula: null,
});
const numCell = (n: number): CellValue => ({ raw: n, normalized: n, display: String(n), formula: null, type: "decimal" });
const strCell = (s: string): CellValue => ({ raw: s, normalized: s, display: s, formula: null, type: "string" });

const table = {
  columns: [col("d", "Date"), col("w", "Day"), col("r", "Revenue")],
  rows: [
    { d: strCell("2026-01-01"), w: strCell("Wed"), r: numCell(100) },
    { d: strCell("2026-01-02"), w: strCell("Thu"), r: numCell(300) },
    { d: strCell("2026-01-05"), w: strCell("Mon"), r: numCell(200) },
  ],
};

describe("dashboard/compute", () => {
  it("builds a chronological series", () => {
    const { labels, points } = timeSeries(table, "Revenue");
    expect(labels).toEqual(["2026-01-01", "2026-01-02", "2026-01-05"]);
    expect(points).toEqual([100, 300, 200]);
  });

  it("groups by day of week ordered Mon→Sun", () => {
    const dow = byDayOfWeek(table, "Revenue");
    expect(dow.map((d) => d.label)).toEqual(["Mon", "Wed", "Thu"]);
    expect(dow[0].value).toBe(200);
  });

  it("returns top rows by value, descending", () => {
    const top = topRows(table, "Revenue", 2);
    expect(top.map((r) => r.value)).toEqual([300, 200]);
    expect(top[0].label).toBe("2026-01-02");
  });

  it("returns empty when the metric column is absent", () => {
    expect(timeSeries(table, "Nope").points).toEqual([]);
  });
});
