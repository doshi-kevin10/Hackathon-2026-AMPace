import { describe, expect, it } from "vitest";
import type { DerivedTable } from "./derive";
import { buildSnapshot, filterByMonth, monthKeyOf, monthSheets } from "./sheets";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const dateCol: ParsedColumn = { id: "d", name: "Date", originalHeader: null, sheetColumn: 0, inferredType: "date", typeOverride: null, formula: null };
const revCol: ParsedColumn = { id: "r", name: "Revenue", originalHeader: null, sheetColumn: 1, inferredType: "currency", typeOverride: null, formula: null };
const calcCol: ParsedColumn = { id: "calc_x", name: "RPC", originalHeader: null, sheetColumn: -1, inferredType: "decimal", typeOverride: null, formula: "[Revenue] / 2" };

const date = (iso: string): CellValue => ({ raw: iso, normalized: iso, display: iso, formula: null, type: "date" });
const num = (n: number, formula: string | null = null): CellValue => ({ raw: n, normalized: n, display: String(n), formula, type: "currency" });

const rows = [
  { d: date("2026-07-15"), r: num(300) },
  { d: date("2026-07-01"), r: num(100) },
  { d: date("2026-06-20"), r: num(200) },
];

describe("monthKeyOf", () => {
  it("extracts YYYY-MM, or null for non-dates", () => {
    expect(monthKeyOf(date("2026-07-15"))).toBe("2026-07");
    expect(monthKeyOf(num(5))).toBeNull();
  });
});

describe("monthSheets", () => {
  it("lists distinct months most-recent first with distinct colors", () => {
    const sheets = monthSheets([dateCol, revCol], rows);
    expect(sheets.map((s) => s.key)).toEqual(["2026-07", "2026-06"]);
    expect(sheets[0].label).toBe("Jul 2026");
    expect(sheets[0].color).not.toBe(sheets[1].color);
  });

  it("is empty with no date column", () => {
    expect(monthSheets([revCol], rows)).toEqual([]);
  });
});

describe("filterByMonth", () => {
  it("keeps only the month's rows and aligns keys to originals", () => {
    const derived: DerivedTable = { columns: [dateCol, revCol], rows, keys: [0, 1, 2] };
    const jul = filterByMonth(derived, "d", "2026-07");
    expect(jul.rows).toHaveLength(2);
    expect(jul.keys).toEqual([0, 1]); // the June row (original index 2) is dropped
  });
});

describe("buildSnapshot", () => {
  it("flattens formulas so every column becomes static and editable", () => {
    const view = { columns: [revCol, calcCol], rows: [{ r: num(100), calc_x: num(50, "[Revenue] / 2") }] };
    const snap = buildSnapshot(view);
    expect(snap.columns.every((c) => c.formula === null)).toBe(true);
    expect(snap.rows[0].calc_x.formula).toBeNull();
    expect(snap.rows[0].calc_x.normalized).toBe(50); // value preserved
    expect(view.rows[0].calc_x.formula).toBe("[Revenue] / 2"); // input untouched
  });
});
