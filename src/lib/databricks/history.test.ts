import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AMPULSE_MOCK = "0"; // exercise the real SQL path, not the demo mock

const executeStatement = vi.fn();
vi.mock("./client", () => ({
  executeStatement: (sql: string) => executeStatement(sql),
  DatabricksError: class DatabricksError extends Error {},
}));

import { getDailySeries } from "./history";

beforeEach(() => executeStatement.mockReset());

describe("getDailySeries", () => {
  it("rejects a non-allowlisted table name before touching Databricks", async () => {
    await expect(getDailySeries("path_metrics")).rejects.toThrow();
    expect(executeStatement).not.toHaveBeenCalled();
  });

  it("runs a single GROUP BY Date aggregation and maps rows to DailyPoints", async () => {
    executeStatement.mockResolvedValue({
      columns: ["d", "a", "c", "r", "cv", "n"],
      rows: [
        ["2026-01-01", "100.5", "50", "500", "5", "1"],
        ["2026-01-02", "300", "100", "900", "20", "1"],
      ],
    });

    const series = await getDailySeries("excel_company_aa");

    expect(executeStatement).toHaveBeenCalledTimes(1);
    const sql = executeStatement.mock.calls[0][0] as string;
    expect(sql).toMatch(/GROUP BY Date/i);
    expect(sql).toMatch(/SUM\(Total_Adspend\)/i);
    expect(sql).toMatch(/excel_company_aa/);

    expect(series.points).toHaveLength(2);
    expect(series.points[0]).toMatchObject({ date: "2026-01-01", total_adspend: 100.5, clicks: 50, rowCount: 1 });
    expect(series.latestDate).toBe("2026-01-02");
  });

  it("flags dates whose raw row count exceeds 1 as duplicates", async () => {
    executeStatement.mockResolvedValue({
      columns: ["d", "a", "c", "r", "cv", "n"],
      rows: [
        ["2026-01-01", "100", "50", "500", "5", "2"], // duplicated in source
        ["2026-01-02", "300", "100", "900", "20", "1"],
      ],
    });
    const series = await getDailySeries("excel_company_aa");
    expect(series.duplicateDates).toEqual(["2026-01-01"]);
    expect(series.points[0].rowCount).toBe(2);
  });

  it("maps SQL NULLs to null metric values (no NaN)", async () => {
    executeStatement.mockResolvedValue({
      columns: ["d", "a", "c", "r", "cv", "n"],
      rows: [["2026-01-01", null, "50", null, "5", "1"]],
    });
    const series = await getDailySeries("excel_company_aa");
    expect(series.points[0].total_adspend).toBeNull();
    expect(series.points[0].revenue).toBeNull();
    expect(series.points[0].clicks).toBe(50);
  });
});
