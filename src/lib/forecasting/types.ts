/**
 * Forecasting types. Two layers:
 *  - `PointModel` — the pure, deterministic numeric core: given a dense finite
 *    series and a horizon, return point predictions. Fully unit-testable.
 *  - `ForecastModel` / `ForecastResult` — the spec-facing wrapper assembled by
 *    `run.ts` (adds prediction intervals, backtest, confidence, metadata).
 */

export interface HistoryPoint {
  date: string; // ISO YYYY-MM-DD
  value: number | null;
}

export interface ForecastInput {
  metric: string;
  history: HistoryPoint[]; // daily, ascending
  horizonDays: number;
  seasonPeriod?: number; // default 7 (weekly)
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

export interface BacktestMetrics {
  mae: number | null;
  rmse: number | null;
  wape: number | null;
  smape: number | null;
  mase: number | null;
}

export type Confidence = "low" | "medium" | "high";

export interface ForecastResult {
  metric: string;
  horizonDays: number;
  modelName: string;
  generatedAt: string;
  trainingStart: string;
  trainingEnd: string;
  observationsUsed: number;
  backtestMetrics: BacktestMetrics;
  points: ForecastPoint[];
  intervalMethod: string;
  intervalLevel: number;
  confidence: Confidence;
  warnings: string[];
}

export interface ForecastModel {
  name: string;
  fitAndPredict(input: ForecastInput): Promise<ForecastResult>;
}

/**
 * The deterministic numeric core. `values` is a dense, finite, evenly-spaced
 * daily series (imputation done upstream). Returns exactly `horizon` predictions.
 */
export interface PointModel {
  name: string;
  /** Minimum observations for this model to be eligible. */
  minObservations: number;
  /** True if the model models seasonality (needs seasonPeriod). */
  seasonal: boolean;
  forecast(values: number[], horizon: number, opts?: { seasonPeriod?: number }): number[];
}
