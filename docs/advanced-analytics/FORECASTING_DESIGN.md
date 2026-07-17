# Forecasting Design

Deterministic, explainable, uncertainty-aware forecasting of advertising metrics. No black-box
deep learning; reproducible from a fixed daily series. All numbers computed in pure TypeScript
(`src/lib/forecasting/`) so they are unit-testable without Databricks.

## Scope

Directly forecast the **additive** components: `Total Adspend`, `Clicks`, `Revenue`, `Conversions`.
Derive ratio forecasts (`CPC`, `ROAS`, `CVR`) from the component forecasts (see METRIC_SEMANTICS.md).

## Interface

```ts
interface ForecastModel {
  name: string;
  fitAndPredict(input: ForecastInput): Promise<ForecastResult>; // async to satisfy the spec;
}                                                                // baseline models resolve sync-ly
```

```ts
type ForecastInput = {
  metric: string;
  history: { date: string; value: number | null }[]; // daily, ascending, gaps allowed (null)
  horizonDays: number;
  seasonPeriod?: number; // 7 for weekly seasonality
};

type ForecastPoint = { date: string; predicted: number; lowerBound: number; upperBound: number };

type ForecastResult = {
  metric: string; horizonDays: number; modelName: string;
  generatedAt: string; trainingStart: string; trainingEnd: string; observationsUsed: number;
  backtestMetrics: { mae: number|null; rmse: number|null; wape: number|null; smape: number|null };
  points: ForecastPoint[];
  intervalMethod: string;      // e.g. "residual-quantile-80"
  intervalLevel: number;       // e.g. 0.80
  confidence: "low"|"medium"|"high";
  warnings: string[];
};
```

## Models (baseline, deterministic)

1. **Naive** — repeat last observed value.
2. **Seasonal naive** — repeat value from `t − seasonPeriod` (period 7). Requires ≥2 seasons.
3. **Moving average** — mean of last `k` (default 7) observations, held flat.
4. **Linear trend** — OLS fit on `(t, value)`, extrapolated.
5. **Exponential smoothing (SES)** — level only; α grid-searched on backtest.
6. **Holt** — level + trend (additive), damped optional; α, β grid-searched.
7. **Holt-Winters** — level + trend + additive weekly seasonality; requires ≥2 full seasons and
   enough history, else excluded from the candidate set.

Numerical care: guard empty/short series; damping to avoid explosive trends; all params from a
small deterministic grid (no RNG) so runs are reproducible. Each model has a unit test with a
hand-checked expected output (TEST_MATRIX #12–16, 21–23).

## Minimum history (configurable — `history-rules.ts`)

Usable observation = a finite, non-negative daily value on a real date.

| Horizon | Min usable daily obs |
|---------|----------------------|
| 7 days  | 42                   |
| 14 days | 60                   |
| 30 days | 120                  |

Holt-Winters additionally needs `≥ 2 × seasonPeriod` and enough for a stable fit; otherwise it is
dropped from candidates (not failed). Horizons whose threshold isn't met are **not offered** by the
API/UI — the forecast is disabled with an explicit warning, never silently degraded to garbage.

## Backtesting — rolling-origin (expanding window)

```
for each origin o in the last N validation points (respecting horizon & min-train):
   train on history[:o]
   predict horizonDays ahead
   score predictions vs history[o:o+h]
aggregate scores across origins
```

Windows count is reported. Models needing more history than available are skipped. Scoring uses:

- **MAE** — mean absolute error.
- **RMSE** — root mean squared error.
- **WAPE** — Σ|actual−pred| / Σ|actual| (robust around zeros; primary ranking metric).
- **sMAPE** — symmetric MAPE (secondary).
- **MASE** — MAE / MAE(seasonal-naive one-step) when a scale exists (else `null`).

MAPE is intentionally avoided as a ranking metric (blows up near zero).

## Model selection

Among **eligible** models (enough history, produced a valid backtest), pick the lowest **WAPE**,
tie-broken by RMSE. Keep all competitors' scores for display. If no model is eligible → no forecast
(warning). The selected model is then refit on the **full** history to generate the live forecast.

## Prediction intervals (uncertainty — always shown)

Method: **residual-based empirical quantiles** from the backtest one-/multi-step errors.

- Collect backtest residuals per step-ahead `h`.
- Interval half-width at horizon step `h` = empirical 80% quantile of `|residual_h|` (falls back to
  a scaled std of residuals if too few residuals), and **grows with `h`** (farther = wider).
- `lower = max(floorForMetric, predicted − width)`, `upper = predicted + width`.
  Non-negative metrics are floored at 0.
- `intervalMethod` / `intervalLevel` recorded on the result. This is an **empirical, documented
  heuristic**, explicitly *not* called a rigorous parametric confidence interval.

For **derived ratios**, the interval is propagated from component bounds
(e.g. `ROAS_lower ≈ Revenue_lower / Adspend_upper`), clamped to sane ranges, and labelled as
derived. Never a single line without a band.

## Confidence classification (deterministic — never from an LLM)

Score 0–1 from four inputs, then band (`high ≥ 0.66`, `medium ≥ 0.4`, else `low`):

1. **Data quantity** — usable obs vs the horizon threshold (more headroom → higher).
2. **Data quality** — the data-quality score (missing/dupe/stale/gaps).
3. **Backtest accuracy** — WAPE (lower → higher confidence).
4. **Interval width** — mean relative half-width (narrower → higher).
5. **Stability** — variance of the selected model's rank/score across validation windows.

Weights are constants in `confidence.ts`, documented and unit-tested.

## Persistence & evaluation

`store.ts` writes each forecast run to `.data/forecasts/<company>/<forecastId>.json` (goal-store
pattern): request params, selected + competing models, backtest metrics, points, warnings,
`generatedAt`, and the training range + data version (latest date + row count) used as the cache key.

`evaluation.ts` closes the loop: once later actual daily data arrives, for each stored forecast
point with a matching actual it records `{ forecastDate, targetDate, predicted, actual, absError,
pctError|null, withinInterval, modelName, horizon }`, aggregates per model/horizon, and feeds the
**forecast-performance** panel. Forecasts that are never evaluated are a design failure — the
performance panel and `GET /forecast-performance` make evaluation first-class.

## Caching & recompute policy

Cache key = `company + metric + horizon + granularity + dataVersion(latestDate,rowCount)`.
In-memory TTL cache + in-flight de-dup (one job per key). Recompute only on: new source data
(dataVersion change), horizon change, model-config change, TTL expiry, or explicit refresh.
Never on the 30s poll.

## Honesty guarantees (UI copy)

Every forecast view shows: *"This forecast is an estimate based on historical patterns and does not
guarantee future performance."* Confidence is labelled. Intervals are always visible. The AI
narrative (if enabled) may interpret but never recompute or claim certainty/causation.
