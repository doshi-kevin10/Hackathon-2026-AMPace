/**
 * Analytics service — fetch a company's daily series and build the deterministic
 * bundle / correlation. The bundle is cached by (company + dataVersion + request)
 * so an unchanged request isn't recomputed; correlation is cheap and uncached.
 */
import { getDailySeries } from "@/lib/databricks/history";
import { createAsyncCache } from "./cache";
import { buildAnalytics, buildCorrelation, type AnalyticsBundle, type CorrelationBundle } from "./engine";
import type { AnalyticsRequestBody, CorrelationRequestBody } from "./request-schemas";

const bundleCache = createAsyncCache<AnalyticsBundle>({ ttlMs: 5 * 60_000 });

export async function getAnalytics(company: string, req: AnalyticsRequestBody): Promise<AnalyticsBundle> {
  const series = await getDailySeries(company);
  const now = new Date().toISOString();
  const dataVersion = `${series.latestDate}_${series.points.length}`;
  const key = `${company}:${dataVersion}:${JSON.stringify(req)}`;
  return bundleCache.get(key, async () => buildAnalytics(series, { ...req, asOf: now.slice(0, 10) }, now));
}

export async function getCorrelation(company: string, req: CorrelationRequestBody): Promise<CorrelationBundle> {
  const series = await getDailySeries(company);
  return buildCorrelation(series, req);
}
