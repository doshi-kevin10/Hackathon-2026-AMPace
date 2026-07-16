import type { CellValue, ColumnType, ParsedWorkbook } from "@/lib/schemas/workbook";

/** Text shown in a table cell: prefer Excel's own display string. */
export const formatCell = (cell: CellValue | undefined): string => {
  if (!cell || cell.raw == null) return "";
  if (cell.display != null) return cell.display;
  return String(cell.normalized ?? cell.raw);
};

export const TYPE_BADGE: Record<ColumnType, string> = {
  string: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  integer: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  decimal: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  currency: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  percentage: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  boolean: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300",
  date: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  datetime: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  formula: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300",
  mixed: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  empty: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export const WARNING_LABELS: Record<string, string> = {
  HEADER_NOT_DETECTED: "No header detected",
  HEADER_UNCERTAIN: "Header uncertain",
  MULTIPLE_HEADER_CANDIDATES: "Multiple header candidates",
  IRREGULAR_ROWS: "Irregular rows",
  MERGED_CELLS: "Merged cells",
  MOSTLY_EMPTY: "Mostly empty",
  DUPLICATE_HEADERS: "Duplicate headers",
  FORMULA_HEAVY: "Formula-heavy",
  SHEET_TRUNCATED: "Truncated",
  EMPTY_SHEET: "Empty sheet",
  NOTE_IGNORED: "Stray note ignored",
};

export const warningLabel = (code: string): string => WARNING_LABELS[code] ?? code;

export const workbookStats = (wb: ParsedWorkbook) => {
  let tables = 0;
  let rows = 0;
  let columns = 0;
  let warnings = wb.warnings.length;
  for (const sheet of wb.sheets) {
    tables += sheet.tables.length;
    warnings += sheet.warnings.length;
    for (const t of sheet.tables) {
      rows += t.rowCount;
      columns += t.columns.length;
      warnings += t.warnings.length;
    }
  }
  return { sheets: wb.sheets.length, tables, rows, columns, warnings };
};

export const compact = (n: number): string =>
  new Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard" }).format(n);

// ---------- recent uploads (session-scoped, client only) ----------

export interface RecentWorkbook {
  id: string;
  filename: string;
  uploadedAt: string;
  sheetCount: number;
  tableCount: number;
}

const RECENT_KEY = "excel-studio-recent";

export const getRecentWorkbooks = (): RecentWorkbook[] => {
  try {
    return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]") as RecentWorkbook[];
  } catch {
    return [];
  }
};

export const addRecentWorkbook = (wb: RecentWorkbook): void => {
  const list = [wb, ...getRecentWorkbooks().filter((r) => r.id !== wb.id)].slice(0, 8);
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(list));
};
