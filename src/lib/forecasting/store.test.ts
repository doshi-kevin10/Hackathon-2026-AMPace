import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ForecastResult } from "./types";

const DIR = path.join(os.tmpdir(), "ampulse-forecast-store-test");
process.env.FORECAST_DATA_DIR = DIR;

// import AFTER setting env so the module (which reads env lazily) uses our dir
import { forecastId, getForecast, listForecasts, saveForecast } from "./store";

const result: ForecastResult = {
  metric: "revenue",
  horizonDays: 7,
  modelName: "holt",
  generatedAt: "2026-06-01T00:00:00.000Z",
  trainingStart: "2026-01-01",
  trainingEnd: "2026-05-31",
  observationsUsed: 150,
  backtestMetrics: { mae: 1, rmse: 1, wape: 0.1, smape: 0.1, mase: 0.5 },
  points: [{ date: "2026-06-01", predicted: 100, lowerBound: 90, upperBound: 110 }],
  intervalMethod: "residual-quantile-80",
  intervalLevel: 0.8,
  confidence: "medium",
  warnings: [],
};

beforeAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
});
afterAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
});

describe("forecast store", () => {
  it("derives a stable, filename-safe id from data version + params", () => {
    const id = forecastId("revenue", 7, "2026-05-31", 150);
    expect(id).toMatch(/^[a-z0-9_]+$/);
    expect(forecastId("revenue", 7, "2026-05-31", 150)).toBe(id); // deterministic
    expect(forecastId("revenue", 14, "2026-05-31", 150)).not.toBe(id); // params change id
  });

  it("saves and reads back a forecast run", async () => {
    const id = forecastId("revenue", 7, "2026-05-31", 150);
    await saveForecast("excel_company_aa", { id, company: "excel_company_aa", metric: "revenue", horizonDays: 7, dataVersion: "2026-05-31_150", result, createdAt: result.generatedAt });
    const got = await getForecast("excel_company_aa", id);
    expect(got?.result.modelName).toBe("holt");
    const all = await listForecasts("excel_company_aa");
    expect(all).toHaveLength(1);
  });

  it("returns null for an unknown id and rejects unsafe names", async () => {
    expect(await getForecast("excel_company_aa", "nope")).toBeNull();
    await expect(getForecast("../etc", "x")).rejects.toThrow();
  });
});
