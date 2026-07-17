/**
 * Forecast orchestration: densify → backtest-select → refit on full history →
 * residual prediction intervals → deterministic confidence → ForecastResult.
 * Ratio metrics (CPC/ROAS/CVR) are forecast from their components and derived,
 * never modelled directly (keeps the ratio coherent — METRIC_SEMANTICS.md).
 *
 * `generatedAt` is injected so the function is pure and reproducible in tests.
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import type { DailyPoint } from "@/lib/analytics/series";
import { mean } from "@/lib/analytics/statistics";
import { classifyConfidence } from "./confidence";
import { deriveRatioForecast } from "./derived";
import { allowedHorizons, isHorizonSupported, minObservationsFor } from "./history-rules";
import { densify } from "./impute";
import { residualIntervals } from "./intervals";
import { ALL_MODELS } from "./models";
import { selectModel, type SelectionResult } from "./select";
import type { BacktestMetrics, Confidence, ForecastPoint, ForecastResult, PointModel } from "./types";

export type ForecastableMetric = "total_adspend" | "clicks" | "revenue" | "conversions" | "cpc" | "roas" | "cvr";

const RATIO_COMPONENTS: Record<"cpc" | "roas" | "cvr", { num: ForecastableMetric; den: ForecastableMetric }> = {
  cpc: { num: "total_adspend", den: "clicks" },
  roas: { num: "revenue", den: "total_adspend" },
  cvr: { num: "conversions", den: "clicks" },
};

const HONESTY = "This forecast is an estimate based on historical patterns and does not guarantee future performance.";
const MS_PER_DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * MS_PER_DAY).toISOString().slice(0, 10);
const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export interface RunForecastInput {
  metric: ForecastableMetric;
  points: DailyPoint[];
  horizonDays: number;
  seasonPeriod?: number;
  generatedAt: string;
  /** 0..100 data-quality score (feeds confidence). Default 100. */
  dataQualityScore?: number;
  models?: PointModel[];
  intervalLevel?: number;
}

export type RunOutcome =
  | { status: "ok"; result: ForecastResult; selection: SelectionResult }
  | { status: "insufficient"; reason: string; allowedHorizons: number[]; observations: number };

const finiteCount = (points: DailyPoint[], metric: ForecastableMetric): number =>
  points.reduce((n, p) => (canonicalValue(metric, p) != null ? n + 1 : n), 0);

/** Forecast one additive component fully (select → refit → intervals → confidence). */
function forecastAdditive(
  metric: ForecastableMetric,
  input: RunForecastInput
): { result: ForecastResult; selection: SelectionResult; meanRelWidth: number | null; observations: number } {
  const { points, horizonDays, generatedAt } = input;
  const seasonPeriod = input.seasonPeriod ?? 7;
  const level = input.intervalLevel ?? 0.8;
  const models = input.models ?? ALL_MODELS;

  const history = points.map((p) => ({ date: p.date, value: canonicalValue(metric, p) }));
  const dense = densify(history);
  const observations = finiteCount(points, metric);
  const n = dense.values.length;

  const minTrain = Math.max(2 * seasonPeriod, Math.ceil(n * 0.5));
  const config = { horizon: horizonDays, minTrain, seasonPeriod, maxWindows: 24 };
  const selection = selectModel(models, dense.values, config);
  const chosen = models.find((m) => m.name === selection.selected?.name) ?? models[0];

  const rawPreds = chosen.forecast(dense.values, horizonDays, { seasonPeriod });
  const preds = rawPreds.map((v) => Math.max(0, v)); // additive metrics can't be negative
  const residualsByStep = selection.selected?.outcome?.residualsByStep ?? [];
  const iv = residualIntervals(preds, residualsByStep, { level, nonNegative: true });

  const lastDate = dense.dates[dense.dates.length - 1];
  const pointsOut: ForecastPoint[] = preds.map((predicted, i) => ({
    date: addDays(lastDate, i + 1),
    predicted,
    lowerBound: iv.lower[i],
    upperBound: iv.upper[i],
  }));

  const meanRelWidth = mean(iv.halfWidths.map((w, i) => (preds[i] ? w / Math.abs(preds[i]) : null)));
  const metrics: BacktestMetrics = selection.selected?.metrics ?? { mae: null, rmse: null, wape: null, smape: null, mase: null };

  // Stability: how small the backtest RMSE is relative to the level (0..1).
  const actualsMean = mean(selection.selected?.outcome?.actuals.map(Math.abs) ?? []);
  const windowStability =
    metrics.rmse != null && actualsMean && actualsMean > 0 ? Math.max(0, Math.min(1, 1 - metrics.rmse / actualsMean)) : null;

  const confidence = classifyConfidence({
    observations,
    minObservations: minObservationsFor(horizonDays),
    dataQualityScore: input.dataQualityScore ?? 100,
    wape: metrics.wape,
    meanRelativeIntervalWidth: meanRelWidth,
    windowStability,
  });

  const warnings = [HONESTY];
  if (dense.imputed > 0) warnings.push(`${dense.imputed} missing day(s) were imputed before fitting.`);

  const result: ForecastResult = {
    metric,
    horizonDays,
    modelName: chosen.name,
    generatedAt,
    trainingStart: dense.dates[0],
    trainingEnd: lastDate,
    observationsUsed: observations,
    backtestMetrics: metrics,
    points: pointsOut,
    intervalMethod: iv.method,
    intervalLevel: iv.level,
    confidence: confidence.label,
    warnings,
  };
  return { result, selection, meanRelWidth, observations };
}

export function runForecast(input: RunForecastInput): RunOutcome {
  const { metric, points, horizonDays } = input;
  const needed: ForecastableMetric[] =
    metric in RATIO_COMPONENTS
      ? [RATIO_COMPONENTS[metric as "cpc" | "roas" | "cvr"].num, RATIO_COMPONENTS[metric as "cpc" | "roas" | "cvr"].den]
      : [metric];

  const observations = Math.min(...needed.map((f) => finiteCount(points, f)));
  if (!isHorizonSupported(horizonDays, observations)) {
    return {
      status: "insufficient",
      reason: `Need ≥${minObservationsFor(horizonDays)} usable observations for a ${horizonDays}-day forecast (have ${observations}).`,
      allowedHorizons: allowedHorizons(observations),
      observations,
    };
  }

  if (!(metric in RATIO_COMPONENTS)) {
    const { result, selection } = forecastAdditive(metric, input);
    return { status: "ok", result, selection };
  }

  // Ratio: forecast components, then derive.
  const { num, den } = RATIO_COMPONENTS[metric as "cpc" | "roas" | "cvr"];
  const numF = forecastAdditive(num, input);
  const denF = forecastAdditive(den, input);
  const derived = deriveRatioForecast(numF.result.points, denF.result.points);

  const worse = (numF.result.backtestMetrics.wape ?? 1) >= (denF.result.backtestMetrics.wape ?? 1) ? numF.result : denF.result;
  const confidence: Confidence =
    CONF_RANK[numF.result.confidence] <= CONF_RANK[denF.result.confidence] ? numF.result.confidence : denF.result.confidence;

  const result: ForecastResult = {
    metric,
    horizonDays,
    modelName: `derived (${numF.result.modelName} ÷ ${denF.result.modelName})`,
    generatedAt: input.generatedAt,
    trainingStart: numF.result.trainingStart,
    trainingEnd: numF.result.trainingEnd,
    observationsUsed: observations,
    backtestMetrics: worse.backtestMetrics,
    points: derived.points,
    intervalMethod: "derived-from-components",
    intervalLevel: input.intervalLevel ?? 0.8,
    confidence,
    warnings: [HONESTY, `Derived from ${num} and ${den} forecasts.`, ...derived.warnings],
  };
  return { status: "ok", result, selection: numF.selection };
}
