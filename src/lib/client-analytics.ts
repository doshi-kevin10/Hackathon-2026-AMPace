/**
 * Browser → advanced-analytics API client. Sends structured, validated JSON
 * (never SQL) and returns typed results. `import type` keeps all server code
 * (Databricks, fs) out of the client bundle.
 */
import type { Explanation } from "@/lib/analytics/ai-explainer";
import type { AnalyticsBundle, CorrelationBundle } from "@/lib/analytics/engine";
import type { AnalyticsRequestBody, CorrelationRequestBody, ExplainRequestBody, ForecastRequestBody } from "@/lib/analytics/request-schemas";
import type { ForecastPerformance, ForecastServiceResult } from "@/lib/forecasting/service";
import type { StoredForecast } from "@/lib/forecasting/store";

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}

const base = (company: string) => `/api/datasets/${encodeURIComponent(company)}`;

export const fetchAnalytics = (company: string, body: AnalyticsRequestBody, signal?: AbortSignal) =>
  post<AnalyticsBundle>(`${base(company)}/analytics`, body, signal);

export const fetchCorrelation = (company: string, body: CorrelationRequestBody, signal?: AbortSignal) =>
  post<CorrelationBundle>(`${base(company)}/analytics/correlation`, body, signal);

export const createForecast = (company: string, body: ForecastRequestBody, signal?: AbortSignal) =>
  post<ForecastServiceResult>(`${base(company)}/forecasts`, body, signal);

export const fetchStoredForecast = (company: string, id: string, signal?: AbortSignal) =>
  get<StoredForecast>(`${base(company)}/forecasts/${encodeURIComponent(id)}`, signal);

export const fetchForecastPerformance = (company: string, signal?: AbortSignal) =>
  get<ForecastPerformance>(`${base(company)}/forecast-performance`, signal);

export const fetchExplanation = (company: string, body: ExplainRequestBody, signal?: AbortSignal) =>
  post<Explanation>(`${base(company)}/analytics/explain`, body, signal);
