import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

/** Pure aggregations over live dataset rows, for the dashboard widgets. Read-only; never mutates. */

export interface Table {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
}

const colId = (t: Table, name: string): string | undefined => t.columns.find((c) => c.name === name)?.id;

const num = (cell: CellValue | undefined): number | null => {
  if (!cell) return null;
  const v = Number(cell.normalized);
  return Number.isFinite(v) ? v : null;
};

const text = (cell: CellValue | undefined): string =>
  cell?.display ?? (cell?.normalized != null ? String(cell.normalized) : "");

/** A metric over the Date column (chronological). Falls back to row index labels if there's no Date. */
export function timeSeries(t: Table, metric: string): { labels: string[]; points: (number | null)[] } {
  const mId = colId(t, metric);
  const dId = colId(t, "Date");
  if (!mId) return { labels: [], points: [] };
  const labels = t.rows.map((r, i) => (dId ? text(r[dId]) : String(i + 1)));
  const points = t.rows.map((r) => num(r[mId]));
  return { labels, points };
}

const DOW_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dowRank = (label: string): number => {
  const i = DOW_ORDER.findIndex((d) => label.toLowerCase().startsWith(d.toLowerCase()));
  return i === -1 ? 99 : i;
};

/** Sum of a metric grouped by the Day column, ordered Mon→Sun. */
export function byDayOfWeek(t: Table, metric: string): { label: string; value: number }[] {
  const mId = colId(t, metric);
  const dId = colId(t, "Day");
  if (!mId || !dId) return [];
  const totals = new Map<string, number>();
  for (const r of t.rows) {
    const day = text(r[dId]);
    const v = num(r[mId]);
    if (!day || v == null) continue;
    totals.set(day, (totals.get(day) ?? 0) + v);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => dowRank(a.label) - dowRank(b.label));
}

/** Top N rows by a metric, with their Date label. */
export function topRows(t: Table, metric: string, n = 8): { label: string; value: number }[] {
  const mId = colId(t, metric);
  const dId = colId(t, "Date");
  if (!mId) return [];
  return t.rows
    .map((r, i) => ({ label: dId ? text(r[dId]) : `Row ${i + 1}`, value: num(r[mId]) }))
    .filter((r): r is { label: string; value: number } => r.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Which canonical metric columns this table actually has (for the empty-state hints). */
export function availableMetrics(t: Table): string[] {
  const known = ["Revenue", "ROAS", "Total Adspend", "Clicks", "Conversions", "CVR", "CPC", "CPA"];
  return known.filter((m) => colId(t, m));
}
