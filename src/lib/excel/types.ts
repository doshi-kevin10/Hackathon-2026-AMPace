/** Server-internal parser types. Never sent to the client. */

export type SheetJsCellType = "n" | "s" | "b" | "d" | "e" | "z";

export interface MergeInfo {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  /** True on the top-left cell of the merge, false on covered cells. */
  anchor: boolean;
}

export interface MatrixCell {
  /** Raw cached value from the file. Formulas are never evaluated. */
  v: string | number | boolean | Date | null;
  /** Formatted display text, when SheetJS provides one. */
  w: string | null;
  /** Formula text, if the cell is a formula. */
  f: string | null;
  t: SheetJsCellType;
  /** Number format string, when available. */
  z: string | null;
  merge?: MergeInfo;
}

export interface Region {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface CellMatrix {
  sheetName: string;
  /** Used-range dimensions (matrix is indexed from absolute row/col 0). */
  rows: number;
  cols: number;
  cells: (MatrixCell | null)[][];
  merges: Region[];
  hiddenRows: number[];
  hiddenCols: number[];
  /** Set when the sheet exceeded row/cell caps and was cut off. */
  truncated: boolean;
}

export const isEmptyCell = (cell: MatrixCell | null | undefined): boolean =>
  cell == null || cell.v == null || (typeof cell.v === "string" && cell.v.trim() === "");

export interface TableCandidate {
  region: Region;
  /** Title text harvested from a small region just above this table, if any. */
  title: string | null;
}
