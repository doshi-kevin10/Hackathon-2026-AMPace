import { describe, expect, it } from "vitest";
import { isValidDatasetName } from "./analytics";

describe("dataset name allowlist", () => {
  it("accepts managed excel_ table names", () => {
    expect(isValidDatasetName("excel_hackathon_spread_sheet_overstock_table_1")).toBe(true);
  });

  it("rejects unmanaged, traversal, and injection attempts", () => {
    expect(isValidDatasetName("path_metrics")).toBe(false); // not managed
    expect(isValidDatasetName("excel_x`; DROP TABLE y; --")).toBe(false);
    expect(isValidDatasetName("dev_catalog.kevin_dev.excel_x")).toBe(false); // catalog traversal
    expect(isValidDatasetName("excel_x WHERE 1=1")).toBe(false);
    expect(isValidDatasetName("EXCEL_X")).toBe(false); // wrong case → not managed prefix
    expect(isValidDatasetName("")).toBe(false);
  });
});
