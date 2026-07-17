import { applyCalcColumns, calcColumnId, type CalcColumnSpec } from "@/lib/formula/calc-columns";
import type { CellValue, ColumnType, ParsedColumn } from "@/lib/schemas/workbook";

/**
 * Local, client-only edit layer for the data tab. Databricks stays read-only:
 * added rows, edited cells and calc columns live here and are applied on top of
 * the live rows for display and export only.
 */

export interface LocalEdits {
  /** Keyed by `${rowIndex}:${columnId}` where rowIndex is into base+added rows. */
  edits: Record<string, CellValue>;
  addedRows: Record<string, CellValue>[];
  calcSpecs: CalcColumnSpec[];
  /** Original indices (into base+added rows) the user has deleted from the view. */
  deletedRows: number[];
  /** Cell notes (Excel-style comments), keyed like `edits`. Optional so older stored blobs still load. */
  notes?: Record<string, string>;
}

export const emptyEdits = (): LocalEdits => ({ edits: {}, addedRows: [], calcSpecs: [], deletedRows: [], notes: {} });

// --- Pure edit-layer transforms (shared by the live-data hook and custom tables) ---

export const withCellEdit = (l: LocalEdits, rowIndex: number, colId: string, cell: CellValue): LocalEdits => ({
  ...l,
  edits: { ...l.edits, [editKey(rowIndex, colId)]: cell },
});

export const withNote = (l: LocalEdits, rowIndex: number, colId: string, text: string): LocalEdits => {
  const notes = { ...(l.notes ?? {}) };
  const k = editKey(rowIndex, colId);
  if (text.trim()) notes[k] = text.trim();
  else delete notes[k];
  return { ...l, notes };
};

export const withAddedRow = (l: LocalEdits, row: Record<string, CellValue>): LocalEdits => ({
  ...l,
  addedRows: [...l.addedRows, row],
});

export const withDeletedRow = (l: LocalEdits, rowIndex: number): LocalEdits =>
  l.deletedRows.includes(rowIndex) ? l : { ...l, deletedRows: [...l.deletedRows, rowIndex] };

export const withCalcSpec = (l: LocalEdits, spec: CalcColumnSpec): LocalEdits => ({
  ...l,
  calcSpecs: [...l.calcSpecs, spec],
});

export const withoutCalcSpec = (l: LocalEdits, columnId: string): LocalEdits => ({
  ...l,
  calcSpecs: l.calcSpecs.filter((sp) => calcColumnId(sp.id) !== columnId),
});

const NUMERIC = new Set<ColumnType>(["integer", "decimal", "currency", "percentage"]);
const BLANK: CellValue = { raw: null, normalized: null, display: "", formula: null, type: "empty" };

/** Turn typed text into a CellValue, coercing to a number for numeric columns. */
export function editedCell(text: string, type: ColumnType): CellValue {
  const t = text.trim();
  if (t === "") return { ...BLANK };
  const n = Number(t.replace(/[$,]/g, ""));
  const numeric = NUMERIC.has(type) && Number.isFinite(n) && /\d/.test(t);
  return {
    raw: numeric ? n : text,
    normalized: numeric ? n : text,
    display: text,
    formula: null,
    type: numeric ? type : "string",
  };
}

/** A fresh blank row spanning the base (non-calc) columns. */
export function blankRow(columns: ParsedColumn[]): Record<string, CellValue> {
  return Object.fromEntries(columns.filter((c) => c.formula == null).map((c) => [c.id, { ...BLANK }]));
}

export const editKey = (rowIndex: number, columnId: string): string => `${rowIndex}:${columnId}`;

interface Table {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
}

export interface DerivedTable extends Table {
  /** Original index (into base+added rows) for each surviving row — the stable edit/delete key. */
  keys: number[];
}

/**
 * Base rows + appended rows + cell overrides, deleted rows removed, then calc
 * columns on top. `keys[i]` is the original index of output row i, so editing
 * and deleting stay aligned even after rows are filtered out.
 * ponytail: clones every row on any edit (O(n)); fine at the few-hundred-row
 * scale of a company table — switch to per-index copy if a table gets huge.
 */
export function deriveTable(base: Table, local: LocalEdits): DerivedTable {
  let rows = local.addedRows.length ? [...base.rows, ...local.addedRows] : base.rows;

  const editKeys = Object.keys(local.edits);
  if (editKeys.length) {
    rows = rows.map((r) => ({ ...r }));
    for (const key of editKeys) {
      const sep = key.indexOf(":");
      const idx = Number(key.slice(0, sep));
      const colId = key.slice(sep + 1);
      if (rows[idx]) rows[idx][colId] = local.edits[key];
    }
  }

  const deleted = new Set(local.deletedRows);
  const keptRows: Record<string, CellValue>[] = [];
  const keys: number[] = [];
  rows.forEach((r, i) => {
    if (deleted.has(i)) return;
    keptRows.push(r);
    keys.push(i);
  });

  const out = applyCalcColumns({ columns: base.columns, rows: keptRows }, local.calcSpecs);
  return { columns: out.columns, rows: out.rows, keys };
}
