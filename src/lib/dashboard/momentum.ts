import { canonicalValue, emptyTotals, type PeriodTotals } from "@/lib/metrics/aggregate";
import { CANONICAL_FIELDS, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import type { CellValue } from "@/lib/schemas/workbook";
import type { Table } from "./compute";

/**
 * Period-over-period comparison for one metric: latest day vs the day before,
 * last 7 days vs the prior 7, last 30 vs the prior 30. Ratio metrics (ROAS/CVR/
 * CPC) use ratio-of-sums, not an average of daily ratios (reuses the aggregate
 * registry). Pure — computed over whatever rows it's given (incl. Data-tab edits).
 */

type Row = Record<string, CellValue>;

/** Canonical metrics that support period comparison, in display order. */
const METRIC_ORDER = ["Revenue", "Total Adspend", "Clicks", "Conversions", "ROAS", "CVR", "CPC"] as const;

const FIELD_BY_NAME = new Map<string, CanonicalFieldId>(
  Object.values(CANONICAL_FIELDS)
    .filter((f) => f.semantic.kind === "additive" || f.semantic.kind === "ratio")
    .map((f) => [f.displayName, f.id])
);

/** The comparable metrics this table actually has, in display order. */
export function comparableMetrics(t: Table): string[] {
  return METRIC_ORDER.filter((name) => t.columns.some((c) => c.name === name));
}

const colId = (t: Table, name: string): string | undefined => t.columns.find((c) => c.name === name)?.id;
const num = (cell: CellValue | undefined): number | null => {
  const v = Number(cell?.normalized);
  return Number.isFinite(v) ? v : null;
};

const ADDITIVE = ["total_adspend", "clicks", "revenue", "conversions"] as const;

/** Sum the additive canonical components across a set of rows. */
function totalsOf(t: Table, rows: Row[]): PeriodTotals {
  const ids: Record<string, string | undefined> = {
    total_adspend: colId(t, "Total Adspend"),
    clicks: colId(t, "Clicks"),
    revenue: colId(t, "Revenue"),
    conversions: colId(t, "Conversions"),
  };
  const tot = emptyTotals();
  for (const r of rows) {
    for (const k of ADDITIVE) {
      const id = ids[k];
      if (!id) continue;
      const v = num(r[id]);
      if (v == null) continue;
      tot[k] = (tot[k] ?? 0) + v;
    }
    tot.rowCount++;
  }
  return tot;
}

export interface Comparison {
  key: "day" | "week" | "month";
  title: string;
  vs: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  /** Fractional change (0.04 = +4%); null when there's no comparable prior period. */
  pct: number | null;
}

const PERIODS: { key: Comparison["key"]; title: string; vs: string; n: number }[] = [
  { key: "day", title: "Today", vs: "vs yesterday", n: 1 },
  { key: "week", title: "Last 7 days", vs: "vs prior 7 days", n: 7 },
  { key: "month", title: "Last 30 days", vs: "vs prior 30 days", n: 30 },
];

/** Rows sorted chronologically by the Date column (or left as-is when there's none). */
function chronological(t: Table): Row[] {
  const dId = colId(t, "Date");
  if (!dId) return t.rows;
  return [...t.rows].sort((a, b) =>
    String(a[dId]?.normalized ?? "").localeCompare(String(b[dId]?.normalized ?? ""))
  );
}

/** The metric's daily values over the last n rows (chronological), for a sparkline. */
export function metricDailySeries(t: Table, metric: string, n = 30): number[] {
  const mId = colId(t, metric);
  if (!mId) return [];
  return chronological(t)
    .slice(-n)
    .map((r) => Number(r[mId]?.normalized))
    .filter((v) => Number.isFinite(v));
}

export function momentum(t: Table, metric: string): Comparison[] {
  const field = FIELD_BY_NAME.get(metric);
  if (!field) return [];
  const rows = chronological(t);
  const len = rows.length;

  return PERIODS.map(({ key, title, vs, n }) => {
    const current = canonicalValue(field, totalsOf(t, rows.slice(Math.max(0, len - n))));
    // Only compare when a full prior period of history exists.
    const prevRows = len >= 2 * n ? rows.slice(len - 2 * n, len - n) : [];
    const previous = prevRows.length ? canonicalValue(field, totalsOf(t, prevRows)) : null;
    const delta = current != null && previous != null ? current - previous : null;
    const pct = delta != null && previous != null && previous !== 0 ? delta / previous : null;
    return { key, title, vs, current, previous, delta, pct };
  });
}
