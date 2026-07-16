import type { ParserWarning } from "@/lib/schemas/workbook";
import { isEmptyCell, type CellMatrix, type Region, type TableCandidate } from "./types";

const lineHasData = (m: CellMatrix, region: Region, axis: "row" | "col", i: number): boolean => {
  if (axis === "row") {
    for (let c = region.c0; c <= region.c1; c++) if (!isEmptyCell(m.cells[i]?.[c])) return true;
  } else {
    for (let r = region.r0; r <= region.r1; r++) if (!isEmptyCell(m.cells[r]?.[i])) return true;
  }
  return false;
};

/** Slice a region into bands of consecutive populated lines along one axis. */
const splitBands = (m: CellMatrix, region: Region, axis: "row" | "col"): Region[] => {
  const bands: Region[] = [];
  const [lo, hi] = axis === "row" ? [region.r0, region.r1] : [region.c0, region.c1];
  let start = -1;
  for (let i = lo; i <= hi + 1; i++) {
    const has = i <= hi && lineHasData(m, region, axis, i);
    if (has && start < 0) start = i;
    if (!has && start >= 0) {
      bands.push(axis === "row" ? { ...region, r0: start, r1: i - 1 } : { ...region, c0: start, c1: i - 1 });
      start = -1;
    }
  }
  return bands;
};

/**
 * Recursively decompose a region into populated rectangles, alternating
 * row-splits (blank-row separators) and column-splits (blank-column
 * separators). A single blank *cell* never splits anything — only a fully
 * blank line within the region does. Merged cells are expanded beforehand,
 * so a merge spanning a blank line keeps its region connected.
 */
const decompose = (m: CellMatrix, region: Region, depth = 6): Region[] => {
  if (depth === 0) return [region];
  const rowBands = splitBands(m, region, "row");
  if (rowBands.length === 0) return [];
  if (rowBands.length > 1) return rowBands.flatMap((b) => decompose(m, b, depth - 1));
  const colBands = splitBands(m, rowBands[0], "col");
  if (colBands.length > 1) return colBands.flatMap((b) => decompose(m, b, depth - 1));
  return colBands.length === 1 ? [colBands[0]] : [rowBands[0]];
};

export const countPopulated = (m: CellMatrix, region: Region): number => {
  let n = 0;
  for (let r = region.r0; r <= region.r1; r++)
    for (let c = region.c0; c <= region.c1; c++) if (!isEmptyCell(m.cells[r]?.[c])) n++;
  return n;
};

export const regionText = (m: CellMatrix, region: Region): string => {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let r = region.r0; r <= region.r1; r++)
    for (let c = region.c0; c <= region.c1; c++) {
      const cell = m.cells[r]?.[c];
      if (isEmptyCell(cell)) continue;
      const text = (cell!.w ?? String(cell!.v)).trim();
      const anchorKey = cell!.merge ? `${cell!.merge.r0},${cell!.merge.c0}` : `${r},${c}`;
      if (text && !seen.has(anchorKey)) {
        seen.add(anchorKey);
        parts.push(text);
      }
    }
  return parts.join(" ");
};

/** Small fragments (a couple of cells) are treated as titles/notes, not tables. */
const isTiny = (m: CellMatrix, region: Region): boolean => {
  const rows = region.r1 - region.r0 + 1;
  return rows <= 2 && countPopulated(m, region) <= 3;
};

const columnsOverlap = (a: Region, b: Region, slack = 2): boolean =>
  a.c0 <= b.c1 + slack && a.c1 + slack >= b.c0;

export interface DetectionResult {
  candidates: TableCandidate[];
  warnings: ParserWarning[];
}

/**
 * Detect table candidates in a sheet. Tiny fragments directly above a table
 * (within 3 rows, overlapping columns) become that table's title; stray
 * one-off fragments are reported as ignored notes.
 */
export function detectTables(matrix: CellMatrix): DetectionResult {
  const warnings: ParserWarning[] = [];
  if (matrix.rows === 0 || matrix.cols === 0) return { candidates: [], warnings };

  const full: Region = { r0: 0, c0: 0, r1: matrix.rows - 1, c1: matrix.cols - 1 };
  const regions = decompose(matrix, full).sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0);

  const tiny = regions.filter((r) => isTiny(matrix, r));
  let tables = regions.filter((r) => !isTiny(matrix, r));

  // A sheet holding nothing but fragments: keep them as (low-confidence) tables.
  if (tables.length === 0) {
    tables = tiny.splice(0);
  }

  const candidates: TableCandidate[] = tables.map((region) => ({ region, title: null }));

  for (const frag of tiny) {
    const below = candidates.find(
      (c) =>
        c.region.r0 > frag.r1 &&
        c.region.r0 - frag.r1 <= 3 &&
        columnsOverlap(frag, c.region)
    );
    const text = regionText(matrix, frag);
    if (below && text) {
      below.title = below.title ? `${below.title} ${text}` : text;
    } else if (text) {
      warnings.push({
        code: "NOTE_IGNORED",
        message: `Ignored stray note "${text.slice(0, 60)}" outside any table`,
        severity: "info",
      });
    }
  }

  return { candidates, warnings };
}
