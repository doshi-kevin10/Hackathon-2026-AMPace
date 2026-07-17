/**
 * Close the forecasting loop: compare a stored forecast against actuals that
 * arrived later. Per matched target date we record error and whether the actual
 * fell inside the prediction interval; aggregates feed the forecast-performance
 * panel. Forecasts that are never evaluated would be a design failure — this is
 * what makes them accountable.
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import type { DailyPoint } from "@/lib/analytics/series";
import { mae as maeFn, wape as wapeFn } from "./error-metrics";
import type { StoredForecast } from "./store";

export interface ForecastEvaluationPoint {
  targetDate: string;
  predicted: number;
  actual: number;
  absError: number;
  pctError: number | null;
  withinInterval: boolean;
}

export interface ForecastEvaluation {
  forecastId: string;
  metric: string;
  modelName: string;
  horizonDays: number;
  generatedAt: string;
  evaluated: number;
  points: ForecastEvaluationPoint[];
  mae: number | null;
  wape: number | null;
  /** Fraction of evaluated points whose actual fell inside the interval. */
  coverage: number | null;
}

export function evaluateForecast(stored: StoredForecast, actuals: DailyPoint[]): ForecastEvaluation {
  const byDate = new Map(actuals.map((p) => [p.date, p]));
  const metric = stored.result.metric as CanonicalFieldId;

  const points: ForecastEvaluationPoint[] = [];
  const predArr: number[] = [];
  const actArr: number[] = [];

  for (const fp of stored.result.points) {
    const actualPoint = byDate.get(fp.date);
    if (!actualPoint) continue;
    const actual = canonicalValue(metric, actualPoint);
    if (actual == null || !Number.isFinite(actual)) continue;

    points.push({
      targetDate: fp.date,
      predicted: fp.predicted,
      actual,
      absError: Math.abs(actual - fp.predicted),
      pctError: actual !== 0 ? (fp.predicted - actual) / actual : null,
      withinInterval: actual >= fp.lowerBound && actual <= fp.upperBound,
    });
    predArr.push(fp.predicted);
    actArr.push(actual);
  }

  const coverage = points.length ? points.filter((p) => p.withinInterval).length / points.length : null;

  return {
    forecastId: stored.id,
    metric: stored.result.metric,
    modelName: stored.result.modelName,
    horizonDays: stored.horizonDays,
    generatedAt: stored.result.generatedAt,
    evaluated: points.length,
    points,
    mae: maeFn(actArr, predArr),
    wape: wapeFn(actArr, predArr),
    coverage,
  };
}
