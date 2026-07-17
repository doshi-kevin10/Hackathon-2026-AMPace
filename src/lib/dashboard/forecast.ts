import { holtWintersModel } from "@/lib/forecasting/models";
import type { CellValue } from "@/lib/schemas/workbook";
import type { Table } from "./compute";

/**
 * Next-N-day forecast for one metric, for the chatbot-triggered forecast widget.
 * Uses the deterministic additive Holt-Winters model (weekly seasonality) from
 * the forecasting lib — reproducible, no RNG. Pure; runs over the derived table
 * so it includes the user's Data-tab edits. Ratio metrics (ROAS/CVR/CPC) are
 * forecast on their daily values directly (good enough for a projection).
 */

const ADDITIVE_METRICS = new Set(["Revenue", "Total Adspend", "Clicks", "Conversions"]);
const SEASON = 7; // weekly
const FIT_WINDOW = 90;

const colId = (t: Table, name: string): string | undefined => t.columns.find((c) => c.name === name)?.id;
const num = (cell: CellValue | undefined): number => Number(cell?.normalized);

/** ISO dates for the `horizon` days after `lastISO`; falls back to "+Nd" labels if the last date isn't ISO. */
function futureDates(lastISO: string, horizon: number): string[] {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(lastISO) ? new Date(`${lastISO}T00:00:00Z`) : null;
  if (!iso || Number.isNaN(iso.getTime())) return Array.from({ length: horizon }, (_, i) => `+${i + 1}d`);
  return Array.from({ length: horizon }, (_, i) => new Date(iso.getTime() + (i + 1) * 86_400_000).toISOString().slice(0, 10));
}

export interface ForecastResult {
  /** History (shown) + horizon future labels. */
  labels: string[];
  /** Actuals then nulls for the future portion. */
  actual: (number | null)[];
  /** Nulls for history (except the join point) then the predictions. */
  forecast: (number | null)[];
  horizon: number;
  additive: boolean;
  /** Projected sum (additive) or average (ratio) over the horizon; baseline = same over the prior `horizon` days. */
  projected: number;
  baseline: number | null;
  pct: number | null;
}

export function buildForecast(t: Table, metric: string, horizon = 14, show = 30): ForecastResult | null {
  const mId = colId(t, metric);
  if (!mId) return null;
  const dId = colId(t, "Date");

  const sorted = dId
    ? [...t.rows].sort((a, b) => String(a[dId]?.normalized ?? "").localeCompare(String(b[dId]?.normalized ?? "")))
    : t.rows;
  const hist = sorted
    .map((r) => ({ date: dId ? String(r[dId]?.normalized ?? "") : "", value: num(r[mId]) }))
    .filter((h) => Number.isFinite(h.value));

  if (hist.length < 2 * SEASON) return null; // need at least two weeks to model seasonality

  const values = hist.map((h) => h.value);
  const preds = holtWintersModel
    .forecast(values.slice(-FIT_WINDOW), horizon, { seasonPeriod: SEASON })
    .map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));

  const showN = Math.min(show, values.length);
  const histVals = values.slice(-showN);
  const histDates = hist.slice(-showN).map((h) => h.date);
  const labels = [...histDates, ...futureDates(histDates[histDates.length - 1] ?? "", horizon)];
  const actual: (number | null)[] = [...histVals, ...Array(horizon).fill(null)];
  // Anchor the forecast line to the last actual so the two lines join visually.
  const forecast: (number | null)[] = [...Array(showN - 1).fill(null), histVals[showN - 1], ...preds];

  const additive = ADDITIVE_METRICS.has(metric);
  const priorWindow = values.slice(-horizon);
  const agg = (xs: number[]) => (additive ? xs.reduce((s, v) => s + v, 0) : xs.reduce((s, v) => s + v, 0) / (xs.length || 1));
  const projected = agg(preds);
  const baseline = priorWindow.length ? agg(priorWindow) : null;
  const pct = baseline != null && baseline !== 0 ? (projected - baseline) / baseline : null;

  return { labels, actual, forecast, horizon, additive, projected, baseline, pct };
}
