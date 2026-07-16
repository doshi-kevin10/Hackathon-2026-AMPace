import { describe, expect, it } from "vitest";
import type { CellValue } from "@/lib/schemas/workbook";
import { canonicalColumnIds, createTableSql, DB_COLUMNS, rowTuple, slug } from "./sync";

const cell = (normalized: string | number | boolean | null): CellValue => ({
  raw: normalized,
  normalized,
  display: normalized == null ? null : String(normalized),
  formula: null,
  type: typeof normalized === "number" ? "decimal" : "string",
});

describe("databricks sync SQL", () => {
  it("creates the fixed 9-column schema with the excel_ prefix enforced", () => {
    const sql = createTableSql("excel_demo_table");
    expect(sql).toContain("CREATE OR REPLACE TABLE");
    expect(sql).toContain("`dev_catalog_for_individual_use`.`kevin_dev`.`excel_demo_table`");
    for (const c of DB_COLUMNS) expect(sql).toContain(`${c.name} ${c.sqlType}`);
    expect(() => createTableSql("path_metrics")).toThrow(/Refusing/);
  });

  it("renders row tuples with correct literals, escaping and NULL padding", () => {
    // Columns: Date, Day present; the rest missing (null ids)
    const ids = ["c1", "c2", null, null, null, null, null, null, null];
    const row: Record<string, CellValue> = {
      c1: cell("2025-10-01"),
      c2: cell("It's Wed"),
    };
    expect(rowTuple(row, ids)).toBe("(DATE'2025-10-01','It''s Wed',NULL,NULL,NULL,NULL,NULL,NULL,NULL)");
  });

  it("neutralizes backslash breakout and injection attempts in string cells", () => {
    const ids = [null, "day", null, null, null, null, null, null, null];
    // A trailing backslash must not escape the closing quote...
    expect(rowTuple({ day: cell("evil\\") }, ids)).toBe(
      "(NULL,'evil\\\\',NULL,NULL,NULL,NULL,NULL,NULL,NULL)"
    );
    // ...and quotes/SQL stay inert data.
    expect(rowTuple({ day: cell("'); DROP TABLE x; --") }, ids)).toBe(
      "(NULL,'''); DROP TABLE x; --',NULL,NULL,NULL,NULL,NULL,NULL,NULL)"
    );
  });

  it("rounds BIGINT columns and passes DOUBLEs through", () => {
    const ids = [null, null, "spend", "clicks", null, null, "conv", null, null];
    const row: Record<string, CellValue> = {
      spend: cell(123.456),
      clicks: cell(1000.4),
      conv: cell(12),
    };
    expect(rowTuple(row, ids)).toBe("(NULL,NULL,123.456,1000,NULL,NULL,12,NULL,NULL)");
  });

  it("maps canonical column names onto parsed column ids", () => {
    const table = {
      columns: [
        { id: "col_1", name: "Date" },
        { id: "col_2", name: "Clicks" },
        { id: "col_3", name: "Notes" },
      ],
    } as never;
    expect(canonicalColumnIds(table)).toEqual([
      "col_1", null, null, "col_2", null, null, null, null, null,
    ]);
  });

  it("slugs workbook and table names safely", () => {
    expect(slug("hackathon Spread Sheet .xlsx")).toBe("hackathon_spread_sheet");
    expect(slug("October 2025")).toBe("october_2025");
    expect(slug("///")).toBe("table");
  });
});
