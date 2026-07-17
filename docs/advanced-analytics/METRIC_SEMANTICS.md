# Metric Semantics

Source of truth: `src/lib/metrics/canonical-registry.ts` (shared with AI Playbooks; **read-only**
here). This file documents the semantics the advanced-analytics layer relies on and must never
contradict. If a rule here disagrees with the registry, the registry wins and this doc is wrong.

## Canonical fields (fixed 9-column Databricks schema)

| id             | Display        | Kind      | Aggregation            | Format     | Direction        |
|----------------|----------------|-----------|------------------------|------------|------------------|
| `date`         | Date           | temporal  | —                      | date       | —                |
| `day`          | Day            | dimension | —                      | text       | —                |
| `total_adspend`| Total Adspend  | additive  | `SUM`                  | currency   | context-dependent|
| `clicks`       | Clicks         | additive  | `SUM`                  | integer    | neutral/context  |
| `cpc`          | CPC            | ratio     | `SUM(spend)/SUM(clicks)` | currency | lower is better  |
| `revenue`      | Revenue        | additive  | `SUM`                  | currency   | higher is better |
| `conversions`  | Conversions    | additive  | `SUM`                  | integer    | higher is better |
| `roas`         | ROAS           | ratio     | `SUM(rev)/SUM(spend)`  | number (×) | higher is better |
| `cvr`          | CVR            | ratio     | `SUM(conv)/SUM(clicks)`| percentage | higher is better |

Some companies (`excel_company_bbb`, `excel_company_groupon`) track **CPA** (`SUM(spend)/SUM(conv)`,
lower is better) instead of ROAS — a read-layer relabel only (`usesCpa`). The workspace honours
this the same way the existing KPI/goal code does.

## Aggregation rule (ratio-of-sums) — the one rule that must never break

For any period (a day, week, month, or the whole selected range):

```
Total Adspend = Σ adspend_i           Clicks      = Σ clicks_i
Revenue       = Σ revenue_i           Conversions = Σ conversions_i

CPC  = Σ adspend / Σ clicks
ROAS = Σ revenue / Σ adspend
CVR  = Σ conversions / Σ clicks
CPA  = Σ adspend / Σ conversions
```

**Never** `mean(daily CPC)`, `mean(daily ROAS)`, `mean(daily CVR)`. Averaging daily ratios is
wrong because it weights every day equally regardless of volume. Enforced by reusing
`aggregate.ts::canonicalValue(id, PeriodTotals)`; unit tests assert a hand-built counter-example
where the two methods diverge (TEST_MATRIX #1–3).

## Division-by-zero & non-finite

- Any ratio with a `0` or `null` denominator → **`null`** (never `Infinity`/`NaN`). Matches the
  registry's `zeroDenominator: "null"` and `aggregate.ts`.
- Percent change (`observations.ts::observe`): comparison `null` → `null`; comparison `0` → `null`
  (never ±∞); a `null` current → both changes `null`. A non-zero current vs a `0` baseline is a
  "zero-baseline jump" (`isZeroBaselineJump`) surfaced as a flag, not a percentage.
- All downstream stats (mean, stddev, correlation, trend, forecast) operate only on **finite**
  values; `null`/`NaN`/`±Inf` days are treated as missing observations and counted as such.

## CVR storage convention

CVR is stored as a **fraction** (e.g. `0.023`) and displayed as a percentage (`2.30%`), matching
`pullLiveTable` (`(num*100).toFixed(2)+"%"`) and `formatFieldValue`. All internal math uses the
fraction; only presentation multiplies by 100.

## Derived-ratio forecasting rule

Ratios are **not** forecast directly by default. Forecast the additive components
(Adspend, Clicks, Revenue, Conversions), then derive:

```
CPC_forecast  = Adspend_forecast  / Clicks_forecast
ROAS_forecast = Revenue_forecast  / Adspend_forecast
CVR_forecast  = Conversions_fcst  / Clicks_forecast
```

with the same zero-denominator → `null` rule. This keeps the forecast internally coherent
(a forecast CPC always equals forecast spend ÷ forecast clicks). Direct ratio forecasting is only
adopted if backtesting shows it is both more accurate *and* still coherent (documented if so).

## Metric direction (favorable / unfavorable / neutral)

`metric-direction.ts` centralises presentation semantics so the UI never hardcodes "up = good":

- **higher is better:** Revenue, ROAS, CVR, Conversions → increase favorable, decrease unfavorable.
- **lower is better:** CPC, CPA → decrease favorable, increase unfavorable.
- **context-dependent:** Total Adspend, Clicks → shown **neutral** (a spend increase is not
  judged good or bad without ROAS context). Never auto-colored green/red.

A change smaller than a configurable epsilon (default 0.5%) is rendered **neutral/flat** regardless
of sign, so noise isn't dressed up as a movement.
