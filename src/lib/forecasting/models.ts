/**
 * Deterministic baseline forecasting models. Each operates on a dense, finite,
 * evenly-spaced numeric series and returns `horizon` point predictions. No RNG:
 * smoothing models grid-search their parameters over a fixed grid minimising
 * in-sample one-step SSE, so every run is reproducible.
 */
import { linearRegression } from "@/lib/analytics/trend";
import type { PointModel } from "./types";

const last = <T>(xs: T[]): T => xs[xs.length - 1];
const GRID = [0.1, 0.3, 0.5, 0.7, 0.9];

export const naiveModel: PointModel = {
  name: "naive",
  minObservations: 2,
  seasonal: false,
  forecast: (values, horizon) => Array.from({ length: horizon }, () => last(values)),
};

export const seasonalNaiveModel: PointModel = {
  name: "seasonal_naive",
  minObservations: 14,
  seasonal: true,
  forecast: (values, horizon, opts) => {
    const m = opts?.seasonPeriod ?? 7;
    const n = values.length;
    if (n < m) return naiveModel.forecast(values, horizon);
    return Array.from({ length: horizon }, (_, i) => values[n - m + (i % m)]);
  },
};

export function makeMovingAverageModel(window = 7): PointModel {
  return {
    name: `moving_average_${window}`,
    minObservations: window,
    seasonal: false,
    forecast: (values, horizon) => {
      const k = Math.min(window, values.length);
      const slice = values.slice(values.length - k);
      const mean = slice.reduce((s, v) => s + v, 0) / k;
      return Array.from({ length: horizon }, () => mean);
    },
  };
}
export const movingAverageModel = makeMovingAverageModel(7);

export const linearTrendModel: PointModel = {
  name: "linear_trend",
  minObservations: 3,
  seasonal: false,
  forecast: (values, horizon) => {
    const { slope, intercept } = linearRegression(values);
    if (slope == null || intercept == null) return naiveModel.forecast(values, horizon);
    const n = values.length;
    return Array.from({ length: horizon }, (_, i) => intercept + slope * (n - 1 + (i + 1)));
  },
};

/** SES level recursion; returns the final level (flat forecast) for a given α. */
function sesLevel(values: number[], alpha: number): { level: number; sse: number } {
  let level = values[0];
  let sse = 0;
  for (let t = 1; t < values.length; t++) {
    sse += (values[t] - level) ** 2; // one-step-ahead error uses prior level
    level = alpha * values[t] + (1 - alpha) * level;
  }
  return { level, sse };
}

export const sesModel: PointModel = {
  name: "ses",
  minObservations: 5,
  seasonal: false,
  forecast: (values, horizon) => {
    let best = { level: last(values), sse: Infinity };
    for (const alpha of GRID) {
      const r = sesLevel(values, alpha);
      if (r.sse < best.sse) best = r;
    }
    return Array.from({ length: horizon }, () => best.level);
  },
};

/** Holt linear (level+trend); returns final level/trend for α,β with in-sample SSE. */
function holtFit(values: number[], alpha: number, beta: number): { level: number; trend: number; sse: number } {
  let level = values[0];
  let trend = values[1] - values[0];
  let sse = 0;
  for (let t = 1; t < values.length; t++) {
    const predicted = level + trend; // one-step-ahead
    sse += (values[t] - predicted) ** 2;
    const prevLevel = level;
    level = alpha * values[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { level, trend, sse };
}

export const holtModel: PointModel = {
  name: "holt",
  minObservations: 8,
  seasonal: false,
  forecast: (values, horizon) => {
    if (values.length < 2) return naiveModel.forecast(values, horizon);
    let best = { level: last(values), trend: 0, sse: Infinity };
    for (const alpha of GRID) {
      for (const beta of GRID) {
        const r = holtFit(values, alpha, beta);
        if (Number.isFinite(r.sse) && r.sse < best.sse) best = r;
      }
    }
    return Array.from({ length: horizon }, (_, i) => best.level + (i + 1) * best.trend);
  },
};

/** Additive Holt-Winters fit; returns final state + SSE for α,β,γ. */
function holtWintersFit(values: number[], m: number, alpha: number, beta: number, gamma: number) {
  const n = values.length;
  const firstMean = values.slice(0, m).reduce((s, v) => s + v, 0) / m;
  const secondMean = values.slice(m, 2 * m).reduce((s, v) => s + v, 0) / m;
  let level = firstMean;
  let trend = (secondMean - firstMean) / m;
  const season = values.slice(0, m).map((v) => v - firstMean);
  let sse = 0;
  for (let t = m; t < n; t++) {
    const si = t % m;
    const predicted = level + trend + season[si]; // one-step-ahead
    sse += (values[t] - predicted) ** 2;
    const prevLevel = level;
    level = alpha * (values[t] - season[si]) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season[si] = gamma * (values[t] - level) + (1 - gamma) * season[si];
  }
  return { level, trend, season, sse };
}

export const holtWintersModel: PointModel = {
  name: "holt_winters",
  minObservations: 14,
  seasonal: true,
  forecast: (values, horizon, opts) => {
    const m = opts?.seasonPeriod ?? 7;
    const n = values.length;
    if (n < 2 * m) return seasonalNaiveModel.forecast(values, horizon, opts);
    let best: ReturnType<typeof holtWintersFit> | null = null;
    for (const alpha of GRID)
      for (const beta of GRID)
        for (const gamma of GRID) {
          const r = holtWintersFit(values, m, alpha, beta, gamma);
          if (Number.isFinite(r.sse) && (!best || r.sse < best.sse)) best = r;
        }
    if (!best) return seasonalNaiveModel.forecast(values, horizon, opts);
    const { level, trend, season } = best;
    return Array.from({ length: horizon }, (_, i) => level + (i + 1) * trend + season[(n + i) % m]);
  },
};

/** All baseline models. Seasonal models are filtered out by selection when history is too short. */
export const ALL_MODELS: PointModel[] = [
  naiveModel,
  seasonalNaiveModel,
  movingAverageModel,
  linearTrendModel,
  sesModel,
  holtModel,
  holtWintersModel,
];
