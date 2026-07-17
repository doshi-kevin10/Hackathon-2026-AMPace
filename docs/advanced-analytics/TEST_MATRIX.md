# Test Matrix

> **STATUS: all unit + integration rows implemented and passing (278 tests, tsc clean, build green).**
> Playwright spec (`e2e/advanced-analytics.spec.ts`, all 10 steps) is written; it needs Chromium +
> the Databricks env to execute — the equivalent flow was verified this session via direct API +
> page-render smoke tests against **live Databricks + Claude** (see STATUS.md → Commands run).

Legend: ☐ planned · ☑ done. Each unit test is co-located `*.test.ts` next to its module and uses
deterministic fixtures / seeded data (no RNG, no network). Integration tests mock
`executeStatement`. Playwright drives the workspace against the dev server.

## Unit — deterministic analytics & forecasting

| #  | What                                         | Module                         | Status |
|----|----------------------------------------------|--------------------------------|--------|
| 1  | CPC = Σspend/Σclicks (≠ mean of daily CPC)   | metrics/aggregate*             | ☐      |
| 2  | ROAS = Σrev/Σspend (≠ mean of daily ROAS)    | metrics/aggregate*             | ☐      |
| 3  | CVR = Σconv/Σclicks (≠ mean of daily CVR)    | metrics/aggregate*             | ☐      |
| 4  | Division-by-zero → null (all ratios)         | analytics/series               | ☐      |
| 5  | Period comparison (prev/week/month/qtr/year) | analytics/comparison           | ☐      |
| 6  | Rolling mean & rolling median windows        | analytics/statistics           | ☐      |
| 7  | Trend slope + classification + thresholds    | analytics/trend                | ☐      |
| 8  | Robust anomaly (MAD z-score, extremes)       | analytics/robust-anomalies     | ☐      |
| 9  | Missing-date / gap / stale detection         | analytics/series + data-quality| ☐      |
| 10 | Driver decomposition (exact vs approximate)  | analytics/drivers              | ☐      |
| 11 | Correlation returns null under min samples   | analytics/correlation          | ☐      |
| 12 | Naive forecast                               | forecasting/models/naive       | ☐      |
| 13 | Seasonal-naive forecast (period 7)           | forecasting/models/seasonal-*  | ☐      |
| 14 | Moving-average forecast                      | forecasting/models/moving-*    | ☐      |
| 15 | Linear-trend forecast                        | forecasting/models/linear-*    | ☐      |
| 16 | Exponential-smoothing (SES) forecast         | forecasting/models/ses         | ☐      |
| 17 | Backtest window correctness (origins/train)  | forecasting/backtest           | ☐      |
| 18 | Model selection picks best eligible (WAPE)   | forecasting/select             | ☐      |
| 19 | WAPE & sMAPE (and MAE/RMSE) correctness      | forecasting/error-metrics      | ☐      |
| 20 | Prediction interval widens with horizon      | forecasting/intervals          | ☐      |
| 21 | Derived CPC forecast = spend/clicks fcst     | forecasting/derived            | ☐      |
| 22 | Derived ROAS forecast = rev/spend fcst       | forecasting/derived            | ☐      |
| 23 | Derived CVR forecast = conv/clicks fcst      | forecasting/derived            | ☐      |
| 24 | Insufficient-history → disabled + warning    | forecasting/history-rules+run  | ☐      |
| 25 | Confidence classification is deterministic   | forecasting/confidence         | ☐      |
| +  | Holt / Holt-Winters basic fit                | forecasting/models/holt*       | ☐      |
| +  | Data-quality score + forecast gating         | analytics/data-quality         | ☐      |
| +  | Metric-direction favorable/unfavorable/flat  | analytics/metric-direction     | ☐      |
| +  | Cache: TTL, dataVersion invalidation, dedup  | analytics/cache                | ☐      |

## Integration — APIs (mocked Databricks)

| #  | What                                                             | Status |
|----|------------------------------------------------------------------|--------|
| 26 | `POST /analytics` returns correct deterministic bundle           | ☐      |
| 27 | `POST /analytics/correlation` honours params + min-sample guard  | ☐      |
| 28 | `POST /forecasts` create → persists → returns id + result        | ☐      |
| 29 | `GET  /forecasts/[id]` returns the stored run                    | ☐      |
| 30 | Forecast **authorization**: user cannot forecast another company | ☐      |
| 31 | Forecast **cache**: identical request served from cache          | ☐      |
| 32 | Insufficient history → 200 with disabled forecast + warning      | ☐      |
| 33 | `GET /forecast-performance` after later actuals → evaluation     | ☐      |
| 34 | Databricks not configured → 503 (no crash, no creds leaked)      | ☐      |

## Playwright — workspace flow

| #  | Step                                             | Status |
|----|--------------------------------------------------|--------|
| P1 | Open a company (dashboard → analytics workspace) | ☐      |
| P2 | Change date range                                | ☐      |
| P3 | Compare with previous period                     | ☐      |
| P4 | View historical chart                            | ☐      |
| P5 | Open trend analysis                              | ☐      |
| P6 | Select Revenue forecast                          | ☐      |
| P7 | Select a 14-day horizon                          | ☐      |
| P8 | See forecast line and shaded interval            | ☐      |
| P9 | See model used + backtest accuracy               | ☐      |
| P10| Export forecast results (CSV)                    | ☐      |

## Mock data fixtures (deterministic, seeded)

`src/lib/analytics/__fixtures__/series.ts` — a synthetic daily series with: stable upward trend,
weekly seasonality, controlled (seeded) noise, one known injected anomaly spike, one missing date,
a revenue-decline segment, a spend-increase segment, a CPC-increase segment, a ROAS-decline
segment. Reused across analytics + forecasting tests so expectations are hand-verifiable.

## Final verification gate

`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run test:e2e` · `npm run build`
— plus the manual checklist in the task spec (ratio-of-sums, insufficient-history disable,
intervals visible, cross-company authz, creds never client-side, later evaluation works,
app works with no Anthropic key, Playbooks untouched).
