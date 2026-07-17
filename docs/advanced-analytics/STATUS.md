# Advanced Analytics & Forecasting — STATUS

> Single source of truth for handoff between sessions. Update after every major phase.

## ⚑ PIVOT (owner-directed): AMPulse = AI automation agent

The product was refocused to an **AI automation** theme. Changes on top of the analytics/
forecasting engine below (which is intact and reused):

- **Playbooks & Opportunities DELETED entirely** (owner decision) — pages, API routes,
  components, and libs (`src/lib/{ai,playbooks,opportunities,decisions,analysis-session,
  data-sources}`, `src/app/{playbooks,opportunities,api/playbooks,api/opportunities,
  api/playbook-runs,api/internal,api/ai}`, `src/components/{playbooks,opportunities}`,
  `dataset-view.tsx`, `components/analytics/*`). Shared infra kept: `metrics/*`,
  `access/dataset-access-provider.ts`, `auth`, `databricks`.
- **Mock data mode** (`src/lib/databricks/mock-data.ts`, ON by default; `AMPULSE_MOCK=0` for
  live): 4 story-driven demo companies (Nike healthy, Adidas CPC-blowout, Spotify anomaly,
  Airbnb whale). Wired into `listDatasets`/`getDatasetRows`/`getDailySeries`.
- **Notification watchtower** (`src/lib/notifications/watchtower.ts` + `service.ts` +
  `GET /api/notifications`): deterministic cross-company alerts — direction-aware WoW changes
  (critical/warning/positive) + info-level anomalies. Topbar bell (`notifications-bell.tsx`).
- **Agentic assistant** (`src/lib/agent/agent.ts` + `POST /api/agent` + `agent-panel.tsx`):
  Anthropic tool-use loop (tools over the deterministic engine) with a deterministic mock
  fallback; strips markdown; returns `navigate` actions to drive the UI. "Ask AMPulse" in topbar.
- **Clean shell**: topbar = logo · Ask AMPulse · 🔔 · sign out (no playbooks nav). Company page =
  `CompanyView` with a **Data | Analytics** toggle only. Analytics trimmed: KPIs + AI summary +
  charts + forecast, with drivers/anomalies/stats/correlation in a collapsed "Deep dive".
- **AI output fixed**: no more markdown `**stars**`; agent prompt forbids markdown + `stripMarkdown` safety net.
- Verified LIVE (built server): mock datasets, notifications (Adidas critical / Nike+Spotify
  positive), agent (real Claude, clean, navigates), 30-day comparison populated. **214 tests,
  tsc clean, lint 0 errors, build green.** Walkthrough: `excel-parser/DEMO.md`.

## Current phase

**COMPLETE.** All phases A–H done and verified. 278 unit/integration tests pass, tsc clean, lint 0
errors (2 pre-existing warnings), production build succeeds (18/18 pages). Full flow verified LIVE
against real Databricks + Claude (see "Commands run").

## Completed work

- [x] Repository inspection (architecture, metrics layer, Databricks adapter, charts, auth,
      access, AI layer, persistence pattern, existing analytics UI, test setup).
- [x] Confirmed AI Playbooks session's uncommitted work is entirely **new untracked dirs** — no
      existing tracked file is modified yet. Boundary set (see PLAN.md §6).
- [x] Baseline verification recorded (see "Tests passing").
- [x] Planning docs: PLAN.md, METRIC_SEMANTICS.md, FORECASTING_DESIGN.md, TEST_MATRIX.md, this file.
- [x] **Phase A** — deterministic fixture (`analytics/__fixtures__/series.ts`, seeded, encodes trend/
      seasonality/anomaly/gap/decline/spend-bump), `analytics/series.ts` (DailyPoint, `bucketByGranularity`
      day/week/month with ratio-of-sums, `detectGaps`, `seriesValues`, `weekStart`),
      `analytics/metric-direction.ts` (direction map + `sentimentFor` + epsilon), `analytics/data-quality.ts`
      (0–100 score, issues, forecast gating), `databricks/history.ts` (`getDailySeries` — one aggregation
      query, duplicate-date detection). All TDD (test → fail → pass). +34 tests.
- [x] **Phase B** — `analytics/statistics.ts` (mean/median/min/max/stddev/percentile/rolling/
      volatility/CV), `trend.ts` (OLS `analyzeTrend`: slope, r², %-change, flat-threshold classify,
      short/long MA, acceleration), `comparison.ts` (`resolveComparisonRange` for prev
      period/week/month/quarter/year/custom + `comparePeriods` with `observe`+`sentimentFor`),
      `baseline.ts` (per-metric stats over configurable windows), `robust-anomalies.ts`
      (rolling-median residual + MAD robust-z, unexpected zeros, dedup/severity). Added `totalsOf`/
      `filterByRange` to series.ts. All TDD. +41 tests (199 total).
- [x] **Phase C** — `analytics/drivers.ts` (LMDI exact additive decomposition for revenue/
      conversions/roas/cpc + labelled approximate fallback), `correlation.ts` (Pearson, Spearman,
      lagged ±maxLag, sample-size guard, causation caveat). All TDD. +11 tests (210 total).
- [x] **Phase D** — `forecasting/types.ts` (ForecastModel/PointModel/ForecastResult), `models.ts`
      (naive, seasonal-naive, moving-average, linear-trend, SES, Holt, Holt-Winters — deterministic
      grid search), `error-metrics.ts` (MAE/RMSE/WAPE/sMAPE/MASE + naiveScale), `backtest.ts`
      (rolling-origin, residuals bucketed per step-ahead), `select.ts` (eligibility + lowest-WAPE).
      All TDD. +20 tests (230 total).
- [x] **Phase E** — `forecasting/impute.ts` (densify), `intervals.ts` (residual-quantile PI, widening,
      non-neg floor), `history-rules.ts` (42/60/120 per 7/14/30, env-configurable), `confidence.ts`
      (deterministic 5-signal blend), `derived.ts` (ratio from components + propagated bounds),
      `run.ts` (orchestration → RunOutcome ok/insufficient; ratios derived), `store.ts` (JSON persist,
      deterministic id), `evaluation.ts` (stored vs later actuals: error + interval coverage).
      All TDD. +25 tests (255 total). **Deterministic engine complete.**
- [x] **Phase F backend** — `analytics/engine.ts` (buildAnalytics + buildCorrelation), `cache.ts`
      (TTL + in-flight dedup), `request-schemas.ts` (Zod, `.strict()`), `route-helpers.ts` (authorizeCompany
      + parseBody), `analytics/service.ts` + `forecasting/service.ts` (fetch+compute+cache+persist).
      Routes: POST `/analytics`, POST `/analytics/correlation`, POST `/forecasts`, GET
      `/forecasts/[id]`, GET `/forecast-performance`. +16 tests (275 total; incl. route authz/validation).
- [x] **Phase F+G frontend** — `charts/time-series-chart.tsx` (multi-series, shaded band, forecast
      divider, hover), `client-analytics.ts`, `advanced-analytics/*` panels (comparison, series small-
      multiples, stats, drivers, anomalies, data-quality, correlation, forecast, forecast-performance),
      `analytics-workspace.tsx` (controls + tabs), route `/datasets/[name]/analytics/page.tsx`, dashboard
      entry link. CSV export in forecast panel. tsc + lint clean, **build green**.
- [x] **Phase H** — optional AI explainer (`analytics/ai-explainer.ts`: deterministic mock + Anthropic,
      AI_MODE-gated, structured-input only, never invents numbers, always disclaimered) + `explain` route
      (recomputes bundle server-side) + `ai-summary-panel.tsx`. Playwright spec `e2e/advanced-analytics.spec.ts`
      (10-step flow). Live end-to-end smoke test against real Databricks + Claude. +3 tests (278 total).

## Remaining work

None. Feature complete. Optional future: custom-comparison UI polish, per-window anomaly scale,
Redis-backed cache for multi-instance, direct-ratio forecasting if backtests ever favor it.

- [ ] Phase B — `statistics.ts`, `baseline.ts`, `trend.ts`, `comparison.ts`, `robust-anomalies.ts` + tests.
- [ ] Phase C — `drivers.ts`, `correlation.ts` + tests.
- [ ] Phase D — forecasting `types.ts`, baseline models, `error-metrics.ts`, `backtest.ts`, `select.ts` + tests.
- [ ] Phase E — `intervals.ts`, `derived.ts`, `confidence.ts`, `history-rules.ts`, `run.ts`, `store.ts`, `evaluation.ts` + tests.
- [ ] Phase F — `POST /analytics` + `/analytics/correlation` routes, `cache.ts`, `time-series-chart.tsx`, workspace UI panels.
- [ ] Phase G — forecast APIs + persistence, forecast UI + performance panel, CSV export.
- [ ] Phase H — optional AI explainer (AI_MODE), Playwright, full verification gate.

## Files modified / created

Docs: `docs/advanced-analytics/*`. Source (all NEW/additive):
`src/lib/analytics/{series,metric-direction,data-quality,statistics,trend,comparison,baseline,robust-anomalies}.ts`
(+ `.test.ts`), `src/lib/analytics/__fixtures__/series.ts`, `src/lib/databricks/history.ts` (+ `.test.ts`).
No existing tracked files modified.

**Do-not-touch** (Playbooks-owned): `src/lib/{ai,access,analysis-session,decisions,opportunities,playbooks,data-sources}/**`,
`src/app/api/{ai,playbooks}/**`, `docs/ai-playbooks/**`, `src/components/dataset-view.tsx`,
`src/components/tables/data-table.tsx`. **Reuse read-only:** `src/lib/metrics/**`.

## Commands run

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → **278 passed** (124 baseline + 154 new across A–H)
- `npx eslint src` → 0 errors, 2 pre-existing warnings (TanStack, make-fixtures)
- `npm run build` → success, 18/18 pages, all new routes present
- LIVE smoke (real Databricks + Claude, company `excel_company_bbb`):
  - `POST /analytics` → 200, 197 obs, revenue $2.32M, DQ 100/100
  - `POST /forecasts {revenue,14}` → ok, model linear_trend, confidence high, backtest WAPE 3.6%, 14 pts w/ bounds
  - `POST /forecasts {cpc,7}` → ok, "derived (linear_trend ÷ linear_trend)", coherent bounds
  - `POST /analytics/explain` (AI_MODE=anthropic) → 200, narrative uses only the deterministic numbers + disclaimer
  - unauth `POST /forecasts` → 401 · `path_metrics` → 404 · bad granularity → 400 · workspace page → 200

## Tests passing

**278/278** vitest, **tsc clean**, lint 0 errors, build green.

## Known issues

- Both sessions ultimately surface analytics in the app; conflict avoided by using a **dedicated
  route** `/datasets/[name]/analytics` instead of editing the actively-changing `DatasetView`.
- Persistence is local JSON (`.data/`) — same non-scaled dev pattern as goals/alerts. Fine for
  demo; documented ceiling.
- In-memory cache is per-process (dev single instance). Documented ceiling; not for multi-instance.

## Exact next action

None required — feature complete and verified end-to-end. If resuming: run `npm run test:e2e`
(needs `npx playwright install chromium` + the Databricks env) for the Playwright flow; the
equivalent was verified this session via direct API + page-render smoke tests against real
Databricks + Claude. NOTE: `models.ts` holds all 7 forecast models in one file (not `models/*.ts`).
