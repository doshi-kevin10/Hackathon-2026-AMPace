import * as XLSX from "xlsx";
import type { CellValue, ColumnType } from "@/lib/schemas/workbook";
import { isEmptyCell, type MatrixCell } from "./types";

const CURRENCY_RE = /[$€£¥₹]|\[\$/;

/** Strip quoted literals / bracket sections so their letters don't look like tokens. */
const fmtTokens = (z: string) => z.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");

const isDateFormat = (z: string): boolean => {
  try {
    return XLSX.SSF.is_date(z);
  } catch {
    return /[ymd]/i.test(fmtTokens(z));
  }
};

const hasTimeTokens = (z: string): boolean => /[hs]|AM\/PM/i.test(fmtTokens(z));

const hasTimeComponent = (d: Date): boolean =>
  d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;

/** Classify a single cell. Values are never coerced — this only inspects type + number format. */
export function classifyCell(cell: MatrixCell | null): ColumnType {
  if (isEmptyCell(cell)) return "empty";
  const c = cell as MatrixCell;
  switch (c.t) {
    case "b":
      return "boolean";
    case "d":
      return c.v instanceof Date && hasTimeComponent(c.v) ? "datetime" : "date";
    case "n": {
      const z = c.z ?? "";
      if (z.includes("%")) return "percentage";
      if (CURRENCY_RE.test(z)) return "currency";
      if (z && isDateFormat(z)) return hasTimeTokens(z) ? "datetime" : "date";
      const v = c.v as number;
      return Number.isInteger(v) ? "integer" : "decimal";
    }
    default:
      // strings and error cells ("e") both render as text
      return "string";
  }
}

/**
 * Infer a column type from its data cells. Dominant-type threshold is 90%,
 * with sensible merging inside the numeric and date families. A column whose
 * cells are mostly formulas is reported as "formula".
 */
export function inferColumnType(cells: (MatrixCell | null)[]): ColumnType {
  const counts = new Map<ColumnType, number>();
  let nonEmpty = 0;
  let formulas = 0;

  for (const cell of cells) {
    const t = classifyCell(cell);
    if (t === "empty") continue;
    nonEmpty++;
    if (cell?.f) formulas++;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  if (nonEmpty === 0) return "empty";
  if (formulas / nonEmpty >= 0.6) return "formula";

  const n = (t: ColumnType) => counts.get(t) ?? 0;
  const numeric = n("integer") + n("decimal");

  if (numeric === nonEmpty) return n("decimal") > 0 ? "decimal" : "integer";
  if (n("currency") + numeric === nonEmpty && n("currency") >= nonEmpty / 2) return "currency";
  if (n("percentage") + numeric === nonEmpty && n("percentage") >= nonEmpty / 2) return "percentage";
  if (n("date") + n("datetime") === nonEmpty) return n("datetime") > 0 ? "datetime" : "date";

  for (const [t, count] of counts) {
    if (count / nonEmpty >= 0.9) return t;
  }
  return "mixed";
}

const excelDateToIso = (c: MatrixCell, type: ColumnType): string | number => {
  let iso: string;
  if (c.v instanceof Date) {
    iso = c.v.toISOString();
  } else if (typeof c.v === "number") {
    const d = XLSX.SSF.parse_date_code(c.v);
    if (!d) return c.v;
    iso = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S))).toISOString();
  } else {
    return String(c.v);
  }
  return type === "date" ? iso.slice(0, 10) : iso;
};

/** Build the client-facing cell value: raw Excel value + normalized value + display text. */
export function toCellValue(cell: MatrixCell | null): CellValue {
  const type = classifyCell(cell);
  if (type === "empty") {
    return { raw: null, normalized: null, display: null, formula: cell?.f ?? null, type };
  }
  const c = cell as MatrixCell;
  const raw = c.v instanceof Date ? c.v.toISOString() : (c.v as string | number | boolean);

  let normalized: string | number | boolean | null = raw;
  if (type === "date" || type === "datetime") normalized = excelDateToIso(c, type);
  else if (type === "string") normalized = String(c.v).trim();

  return {
    raw,
    normalized,
    display: c.w ?? (c.v != null ? String(c.v) : null),
    formula: c.f,
    type,
  };
}
