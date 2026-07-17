/**
 * Rolling-origin (expanding-window) backtest. For each origin `o` the model is
 * trained ONLY on `values[0..o-1]` and asked to forecast the next `horizon`
 * steps, which are compared to the held-out actuals. Residuals are bucketed by
 * step-ahead so downstream prediction intervals can widen with the horizon.
 */
import { mae, mase, naiveScale, rmse, smape, wape } from "./error-metrics";
import type { BacktestMetrics, PointModel } from "./types";

export interface BacktestConfig {
  horizon: number;
  minTrain: number;
  /** Keep only the most recent N origins (default 24). */
  maxWindows?: number;
  /** Origin step (default 1). */
  step?: number;
  seasonPeriod?: number;
}

export interface BacktestOutcome {
  windows: number;
  actuals: number[];
  predictions: number[];
  /** residualsByStep[h] = (actual − predicted) at step h+1 across all windows. */
  residualsByStep: number[][];
  metrics: BacktestMetrics;
}

export function backtest(model: PointModel, values: number[], config: BacktestConfig): BacktestOutcome {
  const { horizon, minTrain, maxWindows = 24, step = 1, seasonPeriod } = config;

  const origins: number[] = [];
  for (let o = minTrain; o + horizon <= values.length; o += step) origins.push(o);
  const used = origins.slice(Math.max(0, origins.length - maxWindows));

  const actuals: number[] = [];
  const predictions: number[] = [];
  const residualsByStep: number[][] = Array.from({ length: horizon }, () => []);

  for (const o of used) {
    const train = values.slice(0, o);
    const preds = model.forecast(train, horizon, { seasonPeriod });
    for (let h = 0; h < horizon; h++) {
      const a = values[o + h];
      const p = preds[h];
      if (!Number.isFinite(a) || !Number.isFinite(p)) continue;
      actuals.push(a);
      predictions.push(p);
      residualsByStep[h].push(a - p);
    }
  }

  const scale = naiveScale(values);
  const metrics: BacktestMetrics = {
    mae: mae(actuals, predictions),
    rmse: rmse(actuals, predictions),
    wape: wape(actuals, predictions),
    smape: smape(actuals, predictions),
    mase: mase(actuals, predictions, scale),
  };

  return { windows: used.length, actuals, predictions, residualsByStep, metrics };
}
