import { describe, expect, it } from "vitest";
import { applyCalcColumns, calcColumnId, validateCalcColumn, type CalcColumnSpec } from "./calc-columns";
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

const columns = [col("col_1", "Revenue"), col("col_2", "Total Adspend")];
const rows = [
  { col_1: num(1500), col_2: num(450) },
  { col_1: num(1000), col_2: num(0) },
];

describe("validateCalcColumn", () => {
  it("passes a valid formula and rejects bad ones", () => {
    expect(validateCalcColumn(columns, { name: "Profit", formula: "[Revenue] - [Total Adspend]" })).toBeNull();
    expect(validateCalcColumn(columns, { name: "", formula: "[Revenue]" })).toMatch(/name/i);
    expect(validateCalcColumn(columns, { name: "Revenue", formula: "1" })).toMatch(/already exists/);
    expect(validateCalcColumn(columns, { name: "X", formula: "[Nope] * 2" })).toMatch(/Unknown column/);
    expect(validateCalcColumn(columns, { name: "X", formula: "[Revenue] +" })).toBeTruthy();
  });
});

describe("applyCalcColumns", () => {
  it("appends a computed column with per-row values and chosen format", () => {
    const specs: CalcColumnSpec[] = [{ id: "a", name: "Profit", formula: "[Revenue] - [Total Adspend]", format: "currency" }];
    const out = applyCalcColumns({ columns, rows }, specs);
    expect(out.columns.at(-1)?.name).toBe("Profit");
    const cid = calcColumnId("a");
    expect(out.rows[0][cid].normalized).toBe(1050);
    expect(out.rows[0][cid].display).toBe("$1,050");
  });

  it("division by zero yields a blank cell, and calc columns can reference earlier ones", () => {
    const specs: CalcColumnSpec[] = [
      { id: "a", name: "ROAS2", formula: "[Revenue] / [Total Adspend]", format: "number" },
      { id: "b", name: "Doubled", formula: "[ROAS2] * 2", format: "number" },
    ];
    const out = applyCalcColumns({ columns, rows }, specs);
    // Row 2 has adspend 0 → ROAS2 null → Doubled null.
    expect(out.rows[1][calcColumnId("a")].normalized).toBeNull();
    expect(out.rows[1][calcColumnId("b")].normalized).toBeNull();
    // Row 1: 1500/450 ≈ 3.333, doubled ≈ 6.667
    expect(Number(out.rows[0][calcColumnId("b")].normalized)).toBeCloseTo(6.6667, 3);
  });

  it("does not mutate the input rows", () => {
    const original = { columns, rows };
    applyCalcColumns(original, [{ id: "a", name: "P", formula: "[Revenue]*2", format: "number" }]);
    expect(Object.keys(rows[0])).toEqual(["col_1", "col_2"]);
  });
});
