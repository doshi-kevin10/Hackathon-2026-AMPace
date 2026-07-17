# Advanced Analytics & Forecasting — Plan

> Upgrade the company analytics experience into a decision-support workspace, then add
> reliable deterministic historical analysis and forecasting for advertising metrics.
> Built **additively** inside the existing AMPulse Next.js app. Does **not** rewrite the app.

## 0. Guiding constraints (non-negotiable)

- All business calculations are **deterministic**. AI may *explain* results, never *invent* them.
- Ratio metrics (CPC, ROAS, CVR) use **ratio-of-sums**, never averaged daily ratios.
- No arbitrary/AI-generated SQL. No source-table writes. Databricks creds stay server-side.
- Every forecast shows uncertainty; never presented as guaranteed. Correlation ≠ causation.
- Forecasting is disabled/degraded when data quality or history is insufficient.
- The app must work with **no Anthropic key** (`AI_MODE=disabled|mock|anthropic`).
- **Do not** touch files the AI Playbooks session owns (see §6).

## 1. How this maps onto the existing app

| Spec concept        | This codebase                                                            |
|---------------------|--------------------------------------------------------------------------|
| `companyId`         | dataset slug `excel_company_<name>` (`isValidDatasetName`)               |
| company data        | Databricks table, fixed 9-col canonical schema (`DB_COLUMNS`)            |
| canonical metrics   | `src/lib/metrics/canonical-registry.ts` (reused, **read-only**)          |
| ratio-of-sums       | `src/lib/metrics/aggregate.ts` `canonicalValue()` (reused)               |
| change math         | `src/lib/metrics/observations.ts` `observe()` (reused)                   |
| auth guard          | `requireUser()` / `getSessionUser()`                                     |
| authorization       | `databricksDatasetAccessProvider.assertDatasetAccess()` (reused)         |
| SQL client          | `src/lib/databricks/client.ts` `executeStatement()` (reused)             |
| persistence         | local JSON under `.data/` (goal-store pattern, reused)                   |
| AI layer            | `src/lib/ai/*` factory + `AI_MODE` (pattern reused for explainer)        |
| charts              | hand-rolled SVG in `src/components/charts/*` (extended, no new dep)      |

**Data access strategy.** One SQL round-trip per company yields the canonical **daily series**
(`SELECT Date, SUM(Total_Adspend), SUM(Clicks), SUM(Revenue), SUM(Conversions), COUNT(*)
GROUP BY Date ORDER BY Date`). Every deterministic analysis (baseline, trend, comparison,
anomalies, drivers, correlation, data-quality, forecasting) is pure TypeScript over that series
— fully unit-testable with fixtures, no live Databricks needed for tests. Weekly/monthly
granularity = re-bucket the daily series in TS. Ratios always recomputed from summed components.

## 2. Entry point / route strategy (decided)

Build the workspace as a **dedicated additive route** `src/app/datasets/[name]/analytics/page.tsx`,
linked from the dashboard cards. Rationale: the existing basic analytics live inside `DatasetView`
(which the Playbooks session is actively modifying — "lift DataTable state into DatasetView").
A dedicated route delivers the full "100× workspace" without fighting over that file and without
deleting working functionality. The old Analytics tab keeps working.

## 3. API surface (dataset-scoped, reuses existing convention)

Spec suggests `/api/companies/:companyId/...`; we use the established `/api/datasets/[name]/...`
convention so we reuse `requireUser` + `assertDatasetAccess` unchanged. Every route enforces
company authorization independently, validates the body with **Zod**, never accepts raw SQL.

- `POST /api/datasets/[name]/analytics` — **consolidated** deterministic bundle: series (chosen
  granularity), period comparison, trends, baseline stats, anomalies, drivers, data-quality.
  *Deliberate consolidation:* all of these derive from the single daily-series query, so one
  endpoint = one Databricks round-trip instead of 5 (lazier + faster + satisfies the "don't
  recompute / no duplicate jobs" caching requirement). Documented deviation from the suggested
  split endpoints.
- `POST /api/datasets/[name]/analytics/correlation` — two-metric explorer (its own params/lags).
- `POST /api/datasets/[name]/forecasts` — create-or-return cached forecast (metric, horizon);
  persists the run; returns `forecastId` + `ForecastResult`.
- `GET  /api/datasets/[name]/forecasts/[forecastId]` — fetch a stored forecast run.
- `GET  /api/datasets/[name]/forecast-performance` — evaluation of past forecasts vs later actuals.

## 4. Module layout (all new / additive)

```
src/lib/analytics/
  series.ts            DailyPoint, granularity bucketing, gap detection, PeriodTotals per bucket
  metric-direction.ts  favorable/unfavorable/neutral + higher-is-better config
  statistics.ts        mean/median/min/max/stddev/percentile/rolling/volatility
  trend.ts             OLS slope, %-trend, MA short/long, classification, acceleration
  comparison.ts        current vs previous/week/month/quarter/year/custom (+ direction)
  baseline.ts          per-metric baseline over configurable rolling windows
  robust-anomalies.ts  robust z (MAD), rolling-baseline dev, zeros, extremes, missing, stale
  drivers.ts           deterministic decomposition (exact vs approximate, labelled)
  correlation.ts       Pearson, Spearman, lagged, sample-size guard
  data-quality.ts      checks + 0–100 score + forecast-gating
  (existing kpi.ts / chart-data.ts / anomalies.ts / goal-status.ts untouched)

src/lib/forecasting/
  types.ts             ForecastModel, ForecastInput, ForecastResult, ForecastPoint
  models/{naive,seasonal-naive,moving-average,linear-trend,ses,holt,holt-winters}.ts
  error-metrics.ts     MAE, RMSE, WAPE, sMAPE, MASE
  backtest.ts          rolling-origin backtest
  select.ts            eligible-model selection by backtest score
  intervals.ts         residual-based PI, widening with horizon (documented method)
  confidence.ts        deterministic low/med/high from quantity+quality+error+PI width+stability
  derived.ts           CPC/ROAS/CVR from component forecasts
  history-rules.ts     min-history per horizon (configurable)
  run.ts               orchestrate fit→backtest→select→forecast→intervals→confidence
  store.ts             persist forecast runs (.data/forecasts/<company>/<id>.json)
  evaluation.ts        stored forecast vs later actuals; errors + interval coverage

src/lib/databricks/history.ts   getDailySeries(name) — the one aggregation query
src/lib/analytics/cache.ts      in-memory TTL + in-flight dedup, keyed by company+params+dataVersion

src/components/charts/time-series-chart.tsx   SVG: multi-series + shaded band + hover + brush
src/components/advanced-analytics/*.tsx       workspace + panels (see §5)
src/app/datasets/[name]/analytics/page.tsx    the workspace route
```

## 5. UI panels (workspace)

Controls: metric multi-select · granularity (day/week/month) · date range · comparison mode ·
rolling window. Sections: Time-series (small multiples, comparison overlay) · KPI comparison
(direction-aware) · Baseline stats · Trend · Anomalies · Drivers ("why did X change?") ·
Correlation explorer · Data-quality · **Forecast** (metric+horizon, shaded interval, model +
backtest, confidence, warnings, export CSV) · **Forecast performance**. Loading/empty/error
states throughout. Optional AI narrative panel last.

## 6. Files the AI Playbooks session owns — DO NOT TOUCH

`src/lib/{ai,access,analysis-session,decisions,opportunities,playbooks,data-sources}/**`,
`src/app/api/{ai,playbooks}/**`, `docs/ai-playbooks/**`, and **actively-edited** shared UI
`src/components/dataset-view.tsx` + `src/components/tables/data-table.tsx`.
**Shared read-only:** `src/lib/metrics/**` — reuse, never modify.
Only shared file this feature edits: `src/components/dashboard.tsx` (one small entry link) and
additive new files under existing dirs (`src/lib/analytics`, `src/lib/databricks`,
`src/app/api/datasets/[name]`).

## 7. Implementation sequence (phases → STATUS tracks progress)

- **A** docs · metric semantics · data-quality · daily-series + granularity (pure, tested)
- **B** statistics · baseline · trend · comparison · robust anomalies (pure, tested)
- **C** drivers · correlation (pure, tested)
- **D** forecast interface · baseline models · error metrics · backtest · selection (tested)
- **E** intervals · derived ratios · confidence · history rules · store · evaluation (tested)
- **F** analytics + correlation APIs · time-series chart · workspace UI panels
- **G** forecast APIs + persistence · forecast UI + performance panel · export
- **H** optional AI explainer · Playwright · full verification

## 8. Testing & verification

Vitest unit tests co-located (`*.test.ts`) for every pure module (see TEST_MATRIX.md).
Integration tests for the APIs with a mocked Databricks client. Playwright for the 10-step
workspace flow. Final gate: `tsc` · `lint` · `vitest` · Playwright · `next build`.
