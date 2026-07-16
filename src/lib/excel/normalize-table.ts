import * as XLSX from "xlsx";
import type { CellValue, ParsedColumn, ParsedTable, ParserWarning } from "@/lib/schemas/workbook";
import { canonicalizeTable } from "./canonicalize";
import { countPopulated, regionText } from "./detect-tables";
import { detectHeaders, normalizeHeaderNames, type HeaderDetection } from "./detect-headers";
import { inferColumnType, toCellValue } from "./infer-types";
import { mergeIntersects } from "./merged-cells";
import { isEmptyCell, type CellMatrix, type MatrixCell, type Region } from "./types";

export interface ExtractOptions {
  /** Reuse an id (corrections keep table identity stable). */
  id?: string;
  /** Explicit name (user rename), otherwise title or "Table N". */
  name?: string;
  title?: string | null;
  /** 0-based table number within the sheet, for default naming. */
  index: number;
  /** User override for header rows at the top of the region (0/1/2). Skips detection. */
  headerRowCount?: number;
}

const headerTextAt = (m: CellMatrix, r: number, c: number): string | null => {
  const cell = m.cells[r]?.[c];
  if (isEmptyCell(cell)) return null;
  return String(cell!.w ?? cell!.v).trim() || null;
};

/** Combine 1–2 header rows into per-column labels ("Group - Label" for two-row headers). */
const rawHeaderLabels = (m: CellMatrix, region: Region, headerRows: number[]): (string | null)[] => {
  const labels: (string | null)[] = [];
  let carryParent: string | null = null;
  for (let c = region.c0; c <= region.c1; c++) {
    if (headerRows.length === 2) {
      const parent = headerTextAt(m, headerRows[0], c);
      if (parent) carryParent = parent;
      const child = headerTextAt(m, headerRows[1], c);
      const p = parent ?? carryParent;
      // A cell merged vertically across both header rows yields parent === child.
      labels.push(p && child && p !== child ? `${p} - ${child}` : (child ?? p));
    } else if (headerRows.length === 1) {
      labels.push(headerTextAt(m, headerRows[0], c));
    } else {
      labels.push(null);
    }
  }
  return labels;
};

/**
 * Extract a normalized table from a region: detect (or apply overridden)
 * headers, build columns with inferred types, emit rows keyed by column id,
 * and score confidence.
 */
export function extractTable(matrix: CellMatrix, region: Region, opts: ExtractOptions): ParsedTable {
  const warnings: ParserWarning[] = [];

  let header: HeaderDetection;
  if (opts.headerRowCount != null) {
    header = {
      titleRows: [],
      headerRows: Array.from({ length: opts.headerRowCount }, (_, i) => region.r0 + i),
      confidence: 1,
      warnings: [],
    };
  } else {
    header = detectHeaders(matrix, region);
  }
  warnings.push(...header.warnings);

  // Title text: attached fragment above the table, or title rows found inside the region.
  let title = opts.title ?? null;
  if (!title && header.titleRows.length > 0) {
    title =
      regionText(matrix, {
        r0: header.titleRows[0],
        r1: header.titleRows[header.titleRows.length - 1],
        c0: region.c0,
        c1: region.c1,
      }) || null;
  }

  const dataStart = Math.max(
    region.r0,
    (header.headerRows.at(-1) ?? header.titleRows.at(-1) ?? region.r0 - 1) + 1
  );

  const width = region.c1 - region.c0 + 1;
  const labels = rawHeaderLabels(matrix, region, header.headerRows);
  const { names, hadDuplicates } = normalizeHeaderNames(labels);
  if (hadDuplicates) {
    warnings.push({
      code: "DUPLICATE_HEADERS",
      message: "Duplicate column names were renamed (e.g. Revenue_2)",
      severity: "warning",
    });
  }

  // Columns + type inference over data cells only.
  const columns: ParsedColumn[] = [];
  for (let i = 0; i < width; i++) {
    const c = region.c0 + i;
    const dataCells: (MatrixCell | null)[] = [];
    for (let r = dataStart; r <= region.r1; r++) dataCells.push(matrix.cells[r]?.[c] ?? null);
    columns.push({
      id: `col_${i + 1}`,
      name: names[i],
      originalHeader: labels[i],
      sheetColumn: c,
      inferredType: inferColumnType(dataCells),
      typeOverride: null,
      formula: null,
    });
  }

  // Rows.
  const rows: Record<string, CellValue>[] = [];
  let formulaCells = 0;
  let populatedData = 0;
  const rowWidths: number[] = [];
  for (let r = dataStart; r <= region.r1; r++) {
    const row: Record<string, CellValue> = {};
    let rowFilled = 0;
    for (let i = 0; i < width; i++) {
      const cell = matrix.cells[r]?.[region.c0 + i] ?? null;
      row[columns[i].id] = toCellValue(cell);
      if (!isEmptyCell(cell)) {
        rowFilled++;
        populatedData++;
        if (cell!.f) formulaCells++;
      }
    }
    rows.push(row);
    rowWidths.push(rowFilled);
  }

  // Regularity: share of rows matching the modal populated-width.
  const widthCounts = new Map<number, number>();
  for (const wdt of rowWidths) widthCounts.set(wdt, (widthCounts.get(wdt) ?? 0) + 1);
  const modalCount = Math.max(0, ...widthCounts.values());
  const regularity = rowWidths.length ? modalCount / rowWidths.length : 1;

  const dataArea = Math.max(1, (region.r1 - dataStart + 1) * width);
  const density = populatedData / dataArea;

  if (regularity < 0.7 && rows.length >= 3) {
    warnings.push({ code: "IRREGULAR_ROWS", message: "Rows have inconsistent lengths", severity: "warning" });
  }
  if (density < 0.35) {
    warnings.push({ code: "MOSTLY_EMPTY", message: "Table region is mostly empty", severity: "warning" });
  }
  if (populatedData > 0 && formulaCells / populatedData > 0.3) {
    warnings.push({ code: "FORMULA_HEAVY", message: "Many cells are formulas (cached values shown)", severity: "info" });
  }
  if (matrix.merges.some((m) => mergeIntersects(m, { ...region, r0: dataStart }))) {
    warnings.push({ code: "MERGED_CELLS", message: "Merged cells inside the data region", severity: "warning" });
  }

  const confidence = Math.max(
    0,
    Math.min(
      1,
      0.25 * density + 0.35 * header.confidence + 0.25 * regularity + 0.15 * Math.min(1, rows.length / 3)
    )
  );

  const range = XLSX.utils.encode_range(
    { r: region.r0, c: region.c0 },
    { r: region.r1, c: region.c1 }
  );

  const table: ParsedTable = {
    id: opts.id ?? crypto.randomUUID(),
    sheetName: matrix.sheetName,
    name: opts.name ?? title ?? `Table ${opts.index + 1}`,
    title,
    range,
    confidence: Math.round(confidence * 100) / 100,
    headerRows: header.headerRows,
    columns,
    rows,
    rowCount: rows.length,
    excluded: false,
    computedColumns: [],
    warnings,
    source: { startRow: region.r0, endRow: region.r1, startColumn: region.c0, endColumn: region.c1 },
  };

  // Map ad-performance headers onto the canonical vocabulary and derive
  // Day/CPC/ROAS/CVR where possible.
  canonicalizeTable(table);
  return table;
}

export { countPopulated };
