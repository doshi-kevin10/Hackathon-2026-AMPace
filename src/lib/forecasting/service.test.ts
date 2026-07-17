import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { syntheticSeries } from "@/lib/analytics/__fixtures__/series";
import type { DailySeries } from "@/lib/databricks/history";

const DIR = path.join(os.tmpdir(), "ampace-forecast-service-test");
process.env.FORECAST_DATA_DIR = DIR;

const getDailySeries = vi.fn<(name: string) => Promise<DailySeries>>();
vi.mock("@/lib/databricks/history", () => ({ getDailySeries: (n: string) => getDailySeries(n) }));

import { __setForecastClock, getOrCreateForecast, getStoredForecast } from "./service";

const fullSeries: DailySeries = {
  name: "x",
  points: syntheticSeries(),
  duplicateDates: [],
  latestDate: syntheticSeries()[syntheticSeries().length - 1].date,
  rowCount: 149,
};
const shortSeries: DailySeries = {
  name: "x",
  points: syntheticSeries().slice(0, 20),
  duplicateDates: [],
  latestDate: syntheticSeries()[19].date,
  rowCount: 20,
};

beforeAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
  __setForecastClock(() => "2026-07-01T00:00:00.000Z");
});
afterAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
});

describe("getOrCreateForecast", () => {
  it("produces and persists a forecast when history is sufficient", async () => {
    getDailySeries.mockResolvedValue(fullSeries);
    const res = await getOrCreateForecast("excel_company_a", "revenue", 7);
    expect(res.status).toBe("ok");
    expect(res.result!.points).toHaveLength(7);
    expect(res.competingModels!.length).toBeGreaterThan(0);
    const stored = await getStoredForecast("excel_company_a", res.forecastId!);
    expect(stored?.result.modelName).toBe(res.result!.modelName);
  });

  it("returns insufficient (not a crash) when history is too short", async () => {
    getDailySeries.mockResolvedValue(shortSeries);
    const res = await getOrCreateForecast("excel_company_b", "revenue", 7);
    expect(res.status).toBe("insufficient");
    expect(res.reason).toBeTruthy();
  });

  it("serves an unchanged request from cache (same object, no recompute)", async () => {
    getDailySeries.mockResolvedValue(fullSeries);
    const a = await getOrCreateForecast("excel_company_c", "clicks", 7);
    const b = await getOrCreateForecast("excel_company_c", "clicks", 7);
    expect(a.result).toBe(b.result); // cached reference
  });

  it("refresh forces a recompute", async () => {
    getDailySeries.mockResolvedValue(fullSeries);
    const a = await getOrCreateForecast("excel_company_d", "clicks", 7);
    const b = await getOrCreateForecast("excel_company_d", "clicks", 7, { refresh: true });
    expect(a.result).not.toBe(b.result); // fresh object
    expect(b.status).toBe("ok");
  });
});
