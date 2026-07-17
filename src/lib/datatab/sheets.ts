import type { DerivedTable } from "./derive";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

/**
 * Sheet helpers for the Data workspace: split the live data into per-month
 * views (each with its own color) and snapshot a view into a standalone,
 * fully-editable custom table. All pure — no clock, no I/O.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A CSS color from the validated 8-hue chart palette, cycled by index. */
export const sheetColor = (index: number): string => `var(--chart-${(((index % 8) + 8) % 8) + 1})`;

/** A translucent tint of a palette color, for backgrounds. */
export const sheetTint = (color: string, pct = 12): string => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export interface MonthSheet {
  /** `YYYY-MM`, the grouping key. */
  key: string;
  /** e.g. "Jul 2026". */
  label: string;
  color: string;
}

const isDateType = (t: string) => t === "date" || t === "datetime";

/** The first date/datetime column, used to group rows by month. */
export const findDateColumn = (columns: ParsedColumn[]): ParsedColumn | undefined =>
  columns.find((c) => isDateType(c.typeOverride ?? c.inferredType));

/** `YYYY-MM` for a cell whose value is an ISO date string, else null. */
export const monthKeyOf = (cell: CellValue | undefined): string | null => {
  const v = cell?.normalized ?? cell?.raw;
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
};

const monthLabel = (key: string): string => {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  return `${MONTHS[idx] ?? m} ${y}`;
};

/**
 * Distinct months present in the rows, most-recent first, each assigned a stable
 * palette color by position. Empty if there is no date column or no dated rows.
 */
export function monthSheets(columns: ParsedColumn[], rows: Record<string, CellValue>[]): MonthSheet[] {
  const dateCol = findDateColumn(columns);
  if (!dateCol) return [];
  const keys = new Set<string>();
  for (const r of rows) {
    const k = monthKeyOf(r[dateCol.id]);
    if (k) keys.add(k);
  }
  return [...keys]
    .sort((a, b) => b.localeCompare(a))
    .map((key, i) => ({ key, label: monthLabel(key), color: sheetColor(i) }));
}

/** Restrict a derived table to one month, keeping `keys[]` aligned with the survivors. */
export function filterByMonth(derived: DerivedTable, dateColId: string, monthKey: string): DerivedTable {
  const rows: Record<string, CellValue>[] = [];
  const keys: number[] = [];
  derived.rows.forEach((r, i) => {
    if (monthKeyOf(r[dateColId]) === monthKey) {
      rows.push(r);
      keys.push(derived.keys[i]);
    }
  });
  return { columns: derived.columns, rows, keys };
}

/**
 * Copy a view (columns + rows) into a standalone table: formulas are flattened
 * to static, editable values, so the custom table is the user's to change and
 * never recomputes against the live data.
 */
export function buildSnapshot(view: { columns: ParsedColumn[]; rows: Record<string, CellValue>[] }): {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
} {
  const columns = view.columns.map((c) => ({ ...c, formula: null }));
  const ids = columns.map((c) => c.id);
  const rows = view.rows.map((r) =>
    Object.fromEntries(ids.map((id) => [id, { ...(r[id] ?? { raw: null, normalized: null, display: "", formula: null, type: "empty" as const }), formula: null }]))
  );
  return { columns, rows };
}
