import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "./parse-workbook";

/** Build an in-memory workbook, round-trip it through a real .xlsx buffer, and parse it. */
const parse = (sheets: Record<string, XLSX.WorkSheet>) => {
  const wb = XLSX.utils.book_new();
  for (const [name, ws] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, ws, name);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return parseWorkbook(buf, "test.xlsx", "wb-test");
};

const aoa = (rows: unknown[][]) => XLSX.utils.aoa_to_sheet(rows as (string | number | boolean | null)[][]);

describe("parser pipeline", () => {
  it("1. detects one simple table in one sheet", () => {
    const parsed = parse({
      Sheet1: aoa([
        ["Name", "Amount"],
        ["alpha", 10],
        ["beta", 20],
        ["gamma", 30],
      ]),
    });
    expect(parsed.sheets).toHaveLength(1);
    const [table] = parsed.sheets[0].tables;
    expect(parsed.sheets[0].tables).toHaveLength(1);
    expect(table.range).toBe("A1:B4");
    expect(table.columns.map((c) => c.name)).toEqual(["Name", "Amount"]);
    expect(table.headerRows).toEqual([0]);
    expect(table.rowCount).toBe(3);
    expect(table.columns[1].inferredType).toBe("integer");
    expect(table.confidence).toBeGreaterThan(0.7);
  });

  it("2. handles multiple sheets", () => {
    const parsed = parse({
      Revenue: aoa([["Month", "Total"], ["Jan", 100], ["Feb", 200]]),
      Costs: aoa([["Month", "Spend"], ["Jan", 50], ["Feb", 60]]),
    });
    expect(parsed.sheets.map((s) => s.name)).toEqual(["Revenue", "Costs"]);
    expect(parsed.sheets.every((s) => s.tables.length === 1)).toBe(true);
  });

  it("3. splits two tables separated by blank rows", () => {
    const parsed = parse({
      Sheet1: aoa([
        ["Product", "Units"],
        ["A", 1],
        ["B", 2],
        [],
        [],
        ["Region", "Sales"],
        ["East", 100],
        ["West", 200],
      ]),
    });
    const tables = parsed.sheets[0].tables;
    expect(tables).toHaveLength(2);
    expect(tables[0].range).toBe("A1:B3");
    expect(tables[1].range).toBe("A6:B8");
    expect(tables[1].columns.map((c) => c.name)).toEqual(["Region", "Sales"]);
  });

  it("4. splits two tables separated by blank columns", () => {
    const parsed = parse({
      Sheet1: aoa([
        ["Product", "Units", null, "Region", "Sales"],
        ["A", 1, null, "East", 100],
        ["B", 2, null, "West", 200],
        ["C", 3, null, null, null],
      ]),
    });
    const tables = parsed.sheets[0].tables;
    expect(tables).toHaveLength(2);
    expect(tables[0].range).toBe("A1:B4");
    expect(tables[1].range).toBe("D1:E3");
  });

  it("5. attaches title rows above headers to the table", () => {
    const parsed = parse({
      Sheet1: aoa([
        ["Sales Report Q1"],
        [],
        ["Name", "Amount", "Region"],
        ["alpha", 10, "East"],
        ["beta", 20, "West"],
      ]),
    });
    const tables = parsed.sheets[0].tables;
    expect(tables).toHaveLength(1);
    expect(tables[0].title).toBe("Sales Report Q1");
    expect(tables[0].name).toBe("Sales Report Q1");
    expect(tables[0].columns.map((c) => c.name)).toEqual(["Name", "Amount", "Region"]);

    // Inline title (no blank row) inside the same region.
    const inline = parse({
      Sheet1: aoa([
        ["Quarterly Report", null, null, null],
        ["A", "B", "C", "D"],
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]),
    });
    const [t] = inline.sheets[0].tables;
    expect(t.title).toBe("Quarterly Report");
    expect(t.headerRows).toEqual([1]);
    expect(t.columns.map((c) => c.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("6. normalizes duplicate and empty headers", () => {
    const parsed = parse({
      Sheet1: aoa([
        ["Margin", "Margin", "", "Fee"],
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]),
    });
    const [table] = parsed.sheets[0].tables;
    expect(table.columns.map((c) => c.name)).toEqual(["Margin", "Margin_2", "Column_3", "Fee"]);
    expect(table.columns[1].originalHeader).toBe("Margin");
    expect(table.warnings.some((w) => w.code === "DUPLICATE_HEADERS")).toBe(true);
  });

  it("7. handles completely empty sheets", () => {
    const parsed = parse({ Empty: aoa([[]]), Data: aoa([["A", "B"], [1, 2]]) });
    const empty = parsed.sheets[0];
    expect(empty.tables).toHaveLength(0);
    expect(empty.warnings.some((w) => w.code === "EMPTY_SHEET")).toBe(true);
    expect(parsed.sheets[1].tables).toHaveLength(1);
  });

  it("8. handles merged title cells and merges inside data", () => {
    const ws = aoa([
      ["Report", null, null],
      ["A", "B", "C"],
      [1, 2, 3],
      [4, 5, 6],
    ]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    const parsed = parse({ Sheet1: ws });
    const [table] = parsed.sheets[0].tables;
    expect(table.title).toBe("Report");
    expect(table.headerRows).toEqual([1]);
    expect(table.columns.map((c) => c.name)).toEqual(["A", "B", "C"]);

    // Merge inside the data region → warning.
    const ws2 = aoa([
      ["A", "B", "C"],
      ["x", 1, 2],
      [null, 3, 4],
      ["y", 5, 6],
    ]);
    ws2["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }];
    const parsed2 = parse({ Sheet1: ws2 });
    expect(parsed2.sheets[0].tables[0].warnings.some((w) => w.code === "MERGED_CELLS")).toBe(true);
  });

  it("9. infers mixed data types correctly", () => {
    const ws = aoa([
      ["Item", "Price", "Share", "Active", "When", "Notes"],
      ["a", 10.5, 0.25, true, new Date(2026, 0, 15), "x"],
      ["b", 20.25, 0.5, false, new Date(2026, 1, 20), 5],
      ["c", 30.75, 0.75, true, new Date(2026, 2, 25), "z"],
    ]);
    for (const addr of ["B2", "B3", "B4"]) (ws[addr] as XLSX.CellObject).z = "$#,##0.00";
    for (const addr of ["C2", "C3", "C4"]) (ws[addr] as XLSX.CellObject).z = "0.00%";
    const parsed = parse({ Sheet1: ws });
    const types = Object.fromEntries(
      parsed.sheets[0].tables[0].columns.map((c) => [c.name, c.inferredType])
    );
    expect(types).toEqual({
      Item: "string",
      Price: "currency",
      Share: "percentage",
      Active: "boolean",
      When: "date",
      Notes: "mixed",
    });
    // Date cells normalize to ISO while the raw serial is preserved.
    const when = parsed.sheets[0].tables[0].rows[0]["col_5"];
    expect(when.normalized).toBe("2026-01-15");
  });

  it("10. flags irregular row lengths", () => {
    const parsed = parse({
      Sheet1: aoa([
        ["A", "B", "C", "D"],
        [1, 2, 3, 4],
        [1, 2, null, null],
        [1, 2, 3, null],
        [1, null, null, null],
        [1, 2, null, null],
      ]),
    });
    const [table] = parsed.sheets[0].tables;
    expect(table.warnings.some((w) => w.code === "IRREGULAR_ROWS")).toBe(true);
    expect(table.rowCount).toBe(5);
  });

  it("11. detects two-row headers with merged group cells", () => {
    const ws = aoa([
      ["Q1", null, "Q2", null],
      ["Rev", "Cost", "Rev", "Cost"],
      [100, 50, 110, 55],
      [200, 80, 210, 85],
      [300, 90, 310, 95],
    ]);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
    ];
    const parsed = parse({ Sheet1: ws });
    const [table] = parsed.sheets[0].tables;
    expect(table.headerRows).toEqual([0, 1]);
    expect(table.columns.map((c) => c.name)).toEqual([
      "Q1 - Rev",
      "Q1 - Cost",
      "Q2 - Rev",
      "Q2 - Cost",
    ]);
  });

  it("12. reports formula columns without evaluating them", () => {
    const ws = aoa([
      ["A", "B", "Total"],
      [1, 2, 3],
      [4, 5, 9],
    ]);
    (ws["C2"] as XLSX.CellObject).f = "A2+B2";
    (ws["C3"] as XLSX.CellObject).f = "A3+B3";
    const parsed = parse({ Sheet1: ws });
    const [table] = parsed.sheets[0].tables;
    expect(table.columns[2].inferredType).toBe("formula");
    const cell = table.rows[0]["col_3"];
    expect(cell.formula).toBe("A2+B2");
    expect(cell.raw).toBe(3); // cached value, never re-evaluated
  });
});
