import { describe, expect, it } from "vitest";
import { isValidDatasetName } from "./analytics";

describe("dataset name allowlist", () => {
  it("accepts managed excel_company_ table names", () => {
    expect(isValidDatasetName("excel_company_overstock")).toBe(true);
    expect(isValidDatasetName("excel_company_aa")).toBe(true);
  });

  it("rejects unmanaged, traversal, and injection attempts", () => {
    expect(isValidDatasetName("path_metrics")).toBe(false); // not managed
    expect(isValidDatasetName("excel_hackathon_spread_sheet_overstock_table_1")).toBe(false); // old split table
    expect(isValidDatasetName("excel_company_x`; DROP TABLE y; --")).toBe(false);
    expect(isValidDatasetName("dev_catalog.kevin_dev.excel_company_x")).toBe(false); // catalog traversal
    expect(isValidDatasetName("excel_company_x WHERE 1=1")).toBe(false);
    expect(isValidDatasetName("EXCEL_COMPANY_X")).toBe(false); // wrong case → not managed prefix
    expect(isValidDatasetName("")).toBe(false);
  });
});
