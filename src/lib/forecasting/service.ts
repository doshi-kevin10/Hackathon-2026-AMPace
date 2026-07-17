/**
 * Forecast service — the API-facing entry point. Ties together the daily series
 * (Databricks), data-quality gating, deterministic `runForecast`, JSON
 * persistence, and a TTL cache with in-flight de-dup. Recompute happens only
 * when the data version changes, a param changes, the TTL expires, or `refresh`
 * is set — never on the UI's poll.
 */
import { claimNewAlerts } from "@/lib/alerts/alert-store";
import { ownerFor } from "@/lib/alerts/owners";
import { sendSlackAlert } from "@/lib/alerts/slack";
import { createAsyncCache } from "@/lib/analytics/cache";
import { assessDataQuality, type DataQualityReport } from "@/lib/analytics/data-quality";
import { getDailySeries } from "@/lib/databricks/history";
import { evaluateForecast, type ForecastEvaluation } from "./evaluation";
import { runForecast, type ForecastableMetric } from "./run";
import { forecastId, getForecast, listForecasts, saveForecast } from "./store";
import type { BacktestMetrics, ForecastResult } from "./types";

export interface CompetingModel {
  name: string;
  eligible: boolean;
  reason?: string;
  metrics: BacktestMetrics | null;
  windows: number;
}

export interface ForecastServiceResult {
  status: "ok" | "insufficient";
  forecastId?: string;
  result?: ForecastResult;
  competingModels?: CompetingModel[];
  dataQuality: DataQualityReport;
  dataVersion: string;
  reason?: string;
  allowedHorizons?: number[];
}

const cache = createAsyncCache<ForecastServiceResult>({ ttlMs: 10 * 60_000 });

/** Test/DI seam: default clock. */
let clock: () => string = () => new Date().toISOString();
export const __setForecastClock = (fn: () => string) => {
  clock = fn;
};

const dataVersionOf = (latestDate: string | null, obs: number): string => `${latestDate ?? "none"}_${obs}`;

export async function getOrCreateForecast(
  company: string,
  metric: ForecastableMetric,
  horizonDays: number,
  opts: { refresh?: boolean } = {}
): Promise<ForecastServiceResult> {
  const series = await getDailySeries(company);
  const now = clock();
  const asOf = now.slice(0, 10);
  const dataQuality = assessDataQuality(series.points, { asOf, duplicateDates: series.duplicateDates });
  const dataVersion = dataVersionOf(series.latestDate, series.points.length);
  const id = forecastId(metric, horizonDays, series.latestDate ?? "none", series.points.length);
  const key = `${company}:${id}`;
  if (opts.refresh) cache.invalidate(key);

  return cache.get(key, async () => {
    if (!dataQuality.sufficientForForecast) {
      return {
        status: "insufficient",
        dataQuality,
        dataVersion,
        reason: dataQuality.issues.find((i) => i.severity === "critical")?.message ?? "Data quality insufficient for forecasting.",
        allowedHorizons: [],
      };
    }

    const outcome = runForecast({ metric, points: series.points, horizonDays, generatedAt: now, dataQualityScore: dataQuality.score });
    if (outcome.status === "insufficient") {
      return { status: "insufficient", dataQuality, dataVersion, reason: outcome.reason, allowedHorizons: outcome.allowedHorizons };
    }

    const competingModels: CompetingModel[] = outcome.selection.candidates.map((c) => ({
      name: c.name,
      eligible: c.eligible,
      reason: c.reason,
      metrics: c.metrics,
      windows: c.windows,
    }));

    await saveForecast(company, { id, company, metric, horizonDays, dataVersion, result: outcome.result, createdAt: now });

    // A low-confidence run is worth a Slack heads-up (deduped per data version,
    // so the same weak forecast doesn't re-alert until the underlying data moves).
    if (outcome.result.confidence === "low") {
      const key = `${company}:forecast:${metric}:${horizonDays}:${dataVersion}`;
      if ((await claimNewAlerts(company, [key])).length > 0) {
        const wape = outcome.result.backtestMetrics.wape;
        await sendSlackAlert({
          severity: "warning",
          title: `${company} · low-confidence ${metric} forecast (${horizonDays}d)`,
          detail: `The ${horizonDays}-day ${metric} forecast came back *low confidence*${wape != null ? ` (backtest WAPE ${Math.round(wape * 100)}%)` : ""}. Treat it as a rough estimate.`,
          metric,
          owner: ownerFor(company),
          href: `/datasets/${company}/analytics`,
          context: "forecast",
        });
      }
    }

    return { status: "ok", forecastId: id, result: outcome.result, competingModels, dataQuality, dataVersion };
  });
}

export async function getStoredForecast(company: string, id: string) {
  return getForecast(company, id);
}

export interface ForecastPerformance {
  company: string;
  evaluations: ForecastEvaluation[];
  byModel: { model: string; evaluated: number; mae: number | null; wape: number | null; coverage: number | null }[];
  byHorizon: { horizonDays: number; evaluated: number; mae: number | null; wape: number | null; coverage: number | null }[];
}

const weightedAgg = (rows: ForecastEvaluation[]) => {
  const evaluated = rows.reduce((s, r) => s + r.evaluated, 0);
  if (!evaluated) return { evaluated: 0, mae: null, wape: null, coverage: null };
  const totalAbs = rows.reduce((s, r) => s + (r.mae ?? 0) * r.evaluated, 0);
  const within = rows.reduce((s, r) => s + (r.coverage ?? 0) * r.evaluated, 0);
  // WAPE aggregated from per-eval points is approximate here; report the mean of eval WAPEs weighted by count.
  const wapeNum = rows.reduce((s, r) => s + (r.wape ?? 0) * r.evaluated, 0);
  return { evaluated, mae: totalAbs / evaluated, wape: wapeNum / evaluated, coverage: within / evaluated };
};

/** Evaluate every stored forecast for a company against the current actuals. */
export async function getForecastPerformance(company: string): Promise<ForecastPerformance> {
  const series = await getDailySeries(company);
  const stored = await listForecasts(company);
  const evaluations = stored.map((sf) => evaluateForecast(sf, series.points)).filter((e) => e.evaluated > 0);

  const group = <K extends string | number>(keyOf: (e: ForecastEvaluation) => K) => {
    const map = new Map<K, ForecastEvaluation[]>();
    for (const e of evaluations) {
      const k = keyOf(e);
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    return map;
  };

  const byModel = [...group((e) => e.modelName).entries()].map(([model, rows]) => ({ model, ...weightedAgg(rows) }));
  const byHorizon = [...group((e) => e.horizonDays).entries()].map(([horizonDays, rows]) => ({ horizonDays, ...weightedAgg(rows) }));

  return { company, evaluations, byModel, byHorizon };
}
