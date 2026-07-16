import * as XLSX from "xlsx";
import { config } from "@/lib/config";
import { expandMerges } from "./merged-cells";
import type { CellMatrix, MatrixCell, SheetJsCellType } from "./types";

const EMPTY_MATRIX = (sheetName: string): CellMatrix => ({
  sheetName,
  rows: 0,
  cols: 0,
  cells: [],
  merges: [],
  hiddenRows: [],
  hiddenCols: [],
  truncated: false,
});

/**
 * Convert a SheetJS worksheet into a dense cell matrix indexed by absolute
 * row/column. Whitespace-only strings are treated as empty. Merged ranges are
 * expanded so covered cells mirror their anchor.
 */
export function sheetToMatrix(ws: XLSX.WorkSheet, sheetName: string): CellMatrix {
  const ref = ws["!ref"];
  if (!ref) return EMPTY_MATRIX(sheetName);

  const range = XLSX.utils.decode_range(ref);
  let rows = range.e.r + 1;
  const cols = range.e.c + 1;
  let truncated = false;

  if (rows > config.maxRowsPerSheet) {
    rows = config.maxRowsPerSheet;
    truncated = true;
  }
  if (rows * cols > config.maxCellsPerSheet) {
    rows = Math.max(1, Math.floor(config.maxCellsPerSheet / cols));
    truncated = true;
  }

  const cells: (MatrixCell | null)[][] = Array.from({ length: rows }, () =>
    new Array<MatrixCell | null>(cols).fill(null)
  );

  for (const addr of Object.keys(ws)) {
    if (addr.startsWith("!")) continue;
    const pos = XLSX.utils.decode_cell(addr);
    if (pos.r >= rows || pos.c >= cols || pos.r < 0 || pos.c < 0) continue;
    const cell = ws[addr] as XLSX.CellObject;
    if (cell.t === "z") continue;
    if (cell.v == null && !cell.f) continue;
    if (typeof cell.v === "string" && cell.v.trim() === "" && !cell.f) continue;
    cells[pos.r][pos.c] = {
      v: (cell.v as MatrixCell["v"]) ?? null,
      w: cell.w ?? null,
      f: cell.f ?? null,
      t: cell.t as SheetJsCellType,
      z: typeof cell.z === "string" ? cell.z : null,
    };
  }

  const merges = (ws["!merges"] ?? []).map((m) => ({
    r0: m.s.r,
    c0: m.s.c,
    r1: m.e.r,
    c1: m.e.c,
  }));

  const hiddenRows = (ws["!rows"] ?? []).flatMap((r, i) => (r?.hidden && i < rows ? [i] : []));
  const hiddenCols = (ws["!cols"] ?? []).flatMap((c, i) => (c?.hidden && i < cols ? [i] : []));

  const matrix: CellMatrix = { sheetName, rows, cols, cells, merges, hiddenRows, hiddenCols, truncated };
  expandMerges(matrix);
  return matrix;
}
