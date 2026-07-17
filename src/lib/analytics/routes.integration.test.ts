import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { DatasetAccessError } from "@/lib/access/dataset-access-provider";
import { syntheticSeries } from "@/lib/analytics/__fixtures__/series";
import type { DailySeries } from "@/lib/databricks/history";

const DIR = path.join(os.tmpdir(), "ampace-routes-test");
process.env.FORECAST_DATA_DIR = DIR;

const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: () => requireUser() }));

const assertDatasetAccess = vi.fn();
vi.mock("@/lib/access/dataset-access-provider", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, databricksDatasetAccessProvider: { assertDatasetAccess: (...a: unknown[]) => assertDatasetAccess(...a) } };
});

vi.mock("@/lib/databricks/client", async (orig) => {
  const actual = (await orig()) as object;
  return { ...actual, databricksConfigured: () => true };
});

const getDailySeries = vi.fn<(n: string) => Promise<DailySeries>>();
vi.mock("@/lib/databricks/history", () => ({ getDailySeries: (n: string) => getDailySeries(n) }));

import { POST as analyticsPOST } from "@/app/api/datasets/[name]/analytics/route";
import { POST as forecastPOST } from "@/app/api/datasets/[name]/forecasts/route";
import { __setForecastClock } from "@/lib/forecasting/service";

const series: DailySeries = {
  name: "excel_company_aa",
  points: syntheticSeries(),
  duplicateDates: [],
  latestDate: syntheticSeries()[syntheticSeries().length - 1].date,
  rowCount: 149,
};

const ctx = (name: string) => ({ params: Promise.resolve({ name }) });
const post = (body: unknown) => new Request("http://t/api", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  requireUser.mockReset();
  assertDatasetAccess.mockReset();
  getDailySeries.mockReset();
  requireUser.mockResolvedValue({ id: "u1", username: "analyst" });
  assertDatasetAccess.mockResolvedValue({ id: "excel_company_aa" });
  getDailySeries.mockResolvedValue(series);
  __setForecastClock(() => "2026-07-01T00:00:00.000Z");
});
afterAll(async () => {
  await fs.rm(DIR, { recursive: true, force: true });
});

describe("POST /analytics", () => {
  it("401 when unauthenticated", async () => {
    requireUser.mockResolvedValue(NextResponse.json({ error: {} }, { status: 401 }));
    const res = await analyticsPOST(post({}), ctx("excel_company_aa"));
    expect(res.status).toBe(401);
    expect(getDailySeries).not.toHaveBeenCalled();
  });

  it("403 when the user has no access to the company", async () => {
    assertDatasetAccess.mockRejectedValue(new DatasetAccessError("FORBIDDEN", "no access"));
    const res = await analyticsPOST(post({}), ctx("excel_company_other"));
    expect(res.status).toBe(403);
  });

  it("400 on an invalid body", async () => {
    const res = await analyticsPOST(post({ granularity: "hourly" }), ctx("excel_company_aa"));
    expect(res.status).toBe(400);
  });

  it("200 with a bundle on success", async () => {
    const res = await analyticsPOST(post({ metrics: ["revenue"], granularity: "day" }), ctx("excel_company_aa"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.series[0].field).toBe("revenue");
    expect(json.dataQuality).toBeTruthy();
  });
});

describe("POST /forecasts", () => {
  it("enforces authorization — cannot forecast a company you can't access", async () => {
    assertDatasetAccess.mockRejectedValue(new DatasetAccessError("FORBIDDEN", "no access"));
    const res = await forecastPOST(post({ metric: "revenue", horizonDays: 7 }), ctx("excel_company_other"));
    expect(res.status).toBe(403);
    expect(getDailySeries).not.toHaveBeenCalled();
  });

  it("400 on an unsupported horizon", async () => {
    const res = await forecastPOST(post({ metric: "revenue", horizonDays: 10 }), ctx("excel_company_aa"));
    expect(res.status).toBe(400);
  });

  it("200 with an ok forecast on success", async () => {
    const res = await forecastPOST(post({ metric: "revenue", horizonDays: 7 }), ctx("excel_company_aa"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.result.points).toHaveLength(7);
  });
});
