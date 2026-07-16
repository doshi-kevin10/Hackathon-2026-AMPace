import type { CellValue, ColumnType, ParsedColumn } from "@/lib/schemas/workbook";

/** Anything shaped like a live analytics table — a dataset pull or a parsed workbook table. */
export interface AnalyticsTable {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
}

const NUMERIC_TYPES = new Set<ColumnType>(["integer", "decimal", "currency", "percentage"]);
const DATE_TYPES = new Set<ColumnType>(["date", "datetime"]);

const effectiveType = (c: ParsedColumn): ColumnType => c.typeOverride ?? c.inferredType;

export const numericColumns = (table: AnalyticsTable): ParsedColumn[] =>
  table.columns.filter((c) => NUMERIC_TYPES.has(effectiveType(c)));

/** Prefer an actual date/datetime column; fall back to a column literally named "Date". */
export const dateColumn = (table: AnalyticsTable): ParsedColumn | undefined =>
  table.columns.find((c) => DATE_TYPES.has(effectiveType(c))) ??
  table.columns.find((c) => c.name === "Date");

export interface CategoricalOption {
  column: ParsedColumn;
  distinctCount: number;
}

/**
 * String columns worth grouping by: a handful of repeating values, not a
 * mostly-unique text field (e.g. a free-text note column).
 */
export const categoricalColumns = (table: AnalyticsTable): CategoricalOption[] => {
  const out: CategoricalOption[] = [];
  for (const col of table.columns) {
    if (effectiveType(col) !== "string") continue;
    const seen = new Set<string>();
    let nonEmpty = 0;
    for (const row of table.rows) {
      const v = row[col.id]?.normalized;
      if (v == null || v === "") continue;
      nonEmpty++;
      seen.add(String(v));
    }
    if (seen.size >= 2 && seen.size <= 20 && seen.size < nonEmpty * 0.9) {
      out.push({ column: col, distinctCount: seen.size });
    }
  }
  return out;
};

export interface SeriesPoint {
  x: string;
  sortKey: number;
  value: number | null;
}

/** One column's values plotted against an x (date) column, sorted ascending. */
export function lineSeries(table: AnalyticsTable, xColumn: ParsedColumn, valueColumn: ParsedColumn): SeriesPoint[] {
  const points = table.rows.map((row, i) => {
    const xCell = row[xColumn.id];
    const iso = typeof xCell?.normalized === "string" ? xCell.normalized : null;
    const t = iso ? Date.parse(iso) : NaN;
    const label = xCell?.display ?? (xCell?.normalized != null ? String(xCell.normalized) : `#${i + 1}`);
    const n = Number(row[valueColumn.id]?.normalized);
    const value = row[valueColumn.id]?.normalized != null && Number.isFinite(n) ? n : null;
    return { x: label, sortKey: Number.isFinite(t) ? t : i, value };
  });
  return points.sort((a, b) => a.sortKey - b.sortKey);
}

export interface CategoryPoint {
  label: string;
  value: number;
}

/** Sum (or average) a numeric column grouped by a categorical column, sorted descending. */
export function categoryAggregate(
  table: AnalyticsTable,
  catColumn: ParsedColumn,
  valueColumn: ParsedColumn,
  agg: "sum" | "avg" = "sum"
): CategoryPoint[] {
  const groups = new Map<string, { total: number; count: number }>();
  for (const row of table.rows) {
    const catRaw = row[catColumn.id]?.normalized;
    if (catRaw == null || catRaw === "") continue;
    const n = Number(row[valueColumn.id]?.normalized);
    if (!Number.isFinite(n)) continue;
    const key = String(catRaw);
    const entry = groups.get(key) ?? { total: 0, count: 0 };
    entry.total += n;
    entry.count += 1;
    groups.set(key, entry);
  }
  return [...groups.entries()]
    .map(([label, { total, count }]) => ({ label, value: agg === "avg" ? total / count : total }))
    .sort((a, b) => b.value - a.value);
}

const formatBucketBound = (n: number): string =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : Number.isInteger(n) ? String(n) : n.toFixed(1);

/** Bucket a numeric column's values into equal-width bins for a distribution chart. */
export function histogram(table: AnalyticsTable, valueColumn: ParsedColumn, bucketCount = 8): CategoryPoint[] {
  const values = table.rows
    .map((row) => Number(row[valueColumn.id]?.normalized))
    .filter((n) => Number.isFinite(n));
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ label: formatBucketBound(min), value: values.length }];

  const width = (max - min) / bucketCount;
  const buckets = new Array(bucketCount).fill(0);
  for (const v of values) {
    const idx = Math.min(bucketCount - 1, Math.floor((v - min) / width));
    buckets[idx]++;
  }
  return buckets.map((value, i) => ({
    label: `${formatBucketBound(min + i * width)}–${formatBucketBound(min + (i + 1) * width)}`,
    value,
  }));
}
