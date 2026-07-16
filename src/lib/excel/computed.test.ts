import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { applyComputedColumn, ComputedColumnError } from "./computed-columns";
import { evaluate, parseFormula } from "./formula";
import { parseWorkbook } from "./parse-workbook";

const parse = (rows: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(rows as (string | number | boolean | null)[][]),
    "Sheet1"
  );
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return parseWorkbook(buf, "test.xlsx", "wb-test");
};

describe("formula engine", () => {
  const run = (src: string, vars: Record<string, number | null> = {}) =>
    evaluate(parseFormula(src), (name) => vars[name] ?? null);

  it("handles precedence, parentheses, brackets and unary minus", () => {
    expect(run("1 + 2 * 3")).toBe(7);
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(run("= -2 + [Ad Spend] / Clicks", { "Ad Spend": 10, Clicks: 4 })).toBe(0.5);
  });

  it("returns null on division by zero or missing values", () => {
    expect(run("Revenue / Clicks", { Revenue: 5, Clicks: 0 })).toBeNull();
    expect(run("Revenue + 1", { Revenue: null })).toBeNull();
  });

  it("rejects malformed formulas", () => {
    expect(() => parseFormula("Revenue +")).toThrow();
    expect(() => parseFormula("[Unclosed")).toThrow(/closing/);
    expect(() => parseFormula("1 $ 2")).toThrow(/Unexpected/);
  });
});

describe("canonical ad-metrics columns", () => {
  it("renames headers, derives Day/CPC/ROAS/CVR, and orders canonically", () => {
    const parsed = parse([
      ["Date", "Spend", "Clicks", "Revenue", "Conversions"],
      [new Date(2026, 6, 1), 450, 1000, 1520, 40],
      [new Date(2026, 6, 2), 500, 1250, 1600, 50],
    ]);
    const [table] = parsed.sheets[0].tables;
    expect(table.columns.map((c) => c.name)).toEqual([
      "Date",
      "Day",
      "Total Adspend",
      "Clicks",
      "CPC",
      "Revenue",
      "Conversions",
      "ROAS",
      "CVR",
    ]);

    const spend = table.columns.find((c) => c.name === "Total Adspend")!;
    expect(spend.originalHeader).toBe("Spend");

    const byName = Object.fromEntries(table.columns.map((c) => [c.name, c.id]));
    const row = table.rows[0];
    expect(row[byName["Day"]].normalized).toBe("Wednesday"); // 2026-07-01
    expect(row[byName["CPC"]].normalized).toBe(0.45);
    expect(row[byName["ROAS"]].normalized).toBeCloseTo(1520 / 450);
    expect(row[byName["CVR"]].normalized).toBeCloseTo(0.04);
    expect(row[byName["CVR"]].display).toBe("4.00%");
    expect(table.columns.find((c) => c.name === "ROAS")!.formula).toBe("[Revenue] / [Total Adspend]");
  });

  it("leaves non-ad tables untouched", () => {
    const parsed = parse([
      ["Name", "Amount"],
      ["a", 1],
    ]);
    expect(parsed.sheets[0].tables[0].columns.map((c) => c.name)).toEqual(["Name", "Amount"]);
  });
});

describe("user-added computed columns", () => {
  const table = () => {
    const parsed = parse([
      ["Date", "Spend", "Clicks", "Revenue", "Conversions"],
      [new Date(2026, 6, 1), 450, 1000, 1520, 40],
    ]);
    return parsed.sheets[0].tables[0];
  };

  it("adds a formula column with per-row values", () => {
    const t = table();
    applyComputedColumn(t, { name: "Profit", formula: "[Revenue] - [Total Adspend]" });
    const col = t.columns.find((c) => c.name === "Profit")!;
    expect(col.formula).toBe("[Revenue] - [Total Adspend]");
    expect(t.rows[0][col.id].normalized).toBe(1070);
  });

  it("rejects duplicate names and unknown references", () => {
    const t = table();
    expect(() => applyComputedColumn(t, { name: "Revenue", formula: "1" })).toThrow(
      ComputedColumnError
    );
    expect(() => applyComputedColumn(t, { name: "X", formula: "[Nope] * 2" })).toThrow(
      /Unknown column/
    );
  });
});
