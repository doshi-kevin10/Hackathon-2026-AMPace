import { describe, expect, it } from "vitest";
import { blankRow, deriveTable, editedCell, editKey, emptyEdits } from "./derive";
import { calcColumnId } from "@/lib/formula/calc-columns";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const col = (id: string, name: string): ParsedColumn => ({
  id,
  name,
  originalHeader: null,
  sheetColumn: -1,
  inferredType: "decimal",
  typeOverride: null,
  formula: null,
});

const num = (n: number): CellValue => ({ raw: n, normalized: n, display: String(n), formula: null, type: "decimal" });

const columns = [col("col_1", "Revenue"), col("col_2", "Clicks")];
const base = {
  columns,
  rows: [
    { col_1: num(1000), col_2: num(100) },
    { col_1: num(2000), col_2: num(200) },
  ],
};

describe("editedCell", () => {
  it("coerces numeric columns and tolerates $ and commas", () => {
    expect(editedCell("$1,250", "currency").normalized).toBe(1250);
    expect(editedCell("abc", "string").normalized).toBe("abc");
    expect(editedCell("  ", "decimal").normalized).toBeNull();
  });
});

describe("deriveTable", () => {
  it("returns base unchanged with no local edits", () => {
    expect(deriveTable(base, emptyEdits()).rows).toHaveLength(2);
  });

  it("applies a cell edit and recomputes calc columns on top", () => {
    const local = {
      edits: { [editKey(0, "col_1")]: num(5000) },
      addedRows: [],
      deletedRows: [],
      calcSpecs: [{ id: "a", name: "RPC", formula: "[Revenue] / [Clicks]", format: "number" as const }],
    };
    const out = deriveTable(base, local);
    expect(out.rows[0].col_1.normalized).toBe(5000);
    expect(out.rows[0][calcColumnId("a")].normalized).toBe(50); // 5000/100, not 10
    expect(base.rows[0].col_1.normalized).toBe(1000); // input untouched
  });

  it("appends added rows and computes calc columns for them", () => {
    const added = { ...blankRow(columns), col_1: num(300), col_2: num(3) };
    const out = deriveTable(base, { edits: {}, addedRows: [added], deletedRows: [], calcSpecs: [
      { id: "a", name: "RPC", formula: "[Revenue] / [Clicks]", format: "number" },
    ] });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[2][calcColumnId("a")].normalized).toBe(100);
  });

  it("removes deleted rows but keeps stable original keys for the survivors", () => {
    const out = deriveTable(base, { edits: {}, addedRows: [], deletedRows: [0], calcSpecs: [] });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].col_1.normalized).toBe(2000); // row 0 gone, row 1 survives
    expect(out.keys).toEqual([1]); // survivor's edit/delete key is still its original index
  });
});
