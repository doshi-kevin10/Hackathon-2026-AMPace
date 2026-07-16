import * as XLSX from "xlsx";
import type { ParsedSheet, ParsedTable, ParsedWorkbook, TablePatch } from "@/lib/schemas/workbook";
import { applyComputedColumn, ComputedColumnError } from "./computed-columns";
import { matrixForSheet } from "./parse-workbook";
import { extractTable } from "./normalize-table";
import type { Region } from "./types";

export class CorrectionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "CorrectionError";
  }
}

const clampRegion = (region: Region, rows: number, cols: number): Region => ({
  r0: Math.max(0, Math.min(region.r0, rows - 1)),
  c0: Math.max(0, Math.min(region.c0, cols - 1)),
  r1: Math.max(0, Math.min(region.r1, rows - 1)),
  c1: Math.max(0, Math.min(region.c1, cols - 1)),
});

const regionOf = (t: ParsedTable): Region => ({
  r0: t.source.startRow,
  c0: t.source.startColumn,
  r1: t.source.endRow,
  c1: t.source.endColumn,
});

/** Re-apply persisted user formula columns after a table was rebuilt from the sheet. */
const reapplyComputedColumns = (table: ParsedTable, specs: { name: string; formula: string }[]): void => {
  for (const spec of specs) {
    try {
      applyComputedColumn(table, spec);
      table.computedColumns.push(spec);
    } catch {
      // Referenced columns no longer exist after the change — drop the computed column.
    }
  }
};

const applySimpleFields = (table: ParsedTable, patch: TablePatch): ParsedTable => {
  const next = { ...table };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.excluded !== undefined) next.excluded = patch.excluded;
  if (patch.company !== undefined) next.company = patch.company;
  if (patch.addColumn) {
    try {
      applyComputedColumn(next, patch.addColumn);
      next.computedColumns = [...next.computedColumns, { ...patch.addColumn }];
    } catch (err) {
      throw new CorrectionError(
        "INVALID_FORMULA",
        err instanceof ComputedColumnError || err instanceof Error ? err.message : "Invalid formula"
      );
    }
  }
  if (patch.columns) {
    next.columns = next.columns.map((col) => {
      const edit = patch.columns!.find((c) => c.id === col.id);
      if (!edit) return col;
      return {
        ...col,
        name: edit.name ?? col.name,
        typeOverride: edit.typeOverride !== undefined ? edit.typeOverride : col.typeOverride,
      };
    });
  }
  if (patch.deleteColumns && patch.deleteColumns.length > 0) {
    const toDelete = new Set(patch.deleteColumns);
    const remaining = next.columns.filter((c) => !toDelete.has(c.id));
    if (remaining.length === 0) {
      throw new CorrectionError("INVALID_PATCH", "A table must keep at least one column");
    }
    const deletedNames = new Set(next.columns.filter((c) => toDelete.has(c.id)).map((c) => c.name));
    next.columns = remaining;
    next.rows = next.rows.map((row) => {
      const copy = { ...row };
      for (const id of toDelete) delete copy[id];
      return copy;
    });
    // Drop any persisted computed-column spec for a deleted formula column so
    // it doesn't reappear the next time the table is re-extracted.
    next.computedColumns = next.computedColumns.filter((cc) => !deletedNames.has(cc.name));
  }
  return next;
};

/**
 * Apply a user correction to one table. Structural changes (range, header
 * rows, split, merge) re-extract from the original file so data, headers and
 * type inference stay consistent; simple edits mutate the stored JSON.
 */
export function applyTablePatch(
  parsed: ParsedWorkbook,
  original: Buffer,
  tableId: string,
  patch: TablePatch
): ParsedWorkbook {
  let sheet: ParsedSheet | undefined;
  let tableIndex = -1;
  for (const s of parsed.sheets) {
    const i = s.tables.findIndex((t) => t.id === tableId);
    if (i >= 0) {
      sheet = s;
      tableIndex = i;
      break;
    }
  }
  if (!sheet) throw new CorrectionError("TABLE_NOT_FOUND", `No table with id ${tableId}`);
  const table = sheet.tables[tableIndex];

  if (patch.splitAtRow !== undefined && patch.mergeWithTableId !== undefined) {
    throw new CorrectionError("INVALID_PATCH", "Cannot split and merge in the same request");
  }

  const structural =
    patch.range !== undefined ||
    patch.headerRowCount !== undefined ||
    patch.splitAtRow !== undefined ||
    patch.mergeWithTableId !== undefined;

  let newTables: ParsedTable[];

  if (!structural) {
    newTables = [applySimpleFields(table, patch)];
  } else {
    const matrix = matrixForSheet(original, sheet.index);
    if (matrix.rows === 0) throw new CorrectionError("INVALID_PATCH", "Sheet is empty");

    if (patch.splitAtRow !== undefined) {
      const splitRow = patch.splitAtRow - 1; // 1-based (as shown in Excel) → 0-based
      const region = regionOf(table);
      if (splitRow <= region.r0 || splitRow > region.r1) {
        throw new CorrectionError(
          "INVALID_PATCH",
          `Split row must be inside the table (rows ${region.r0 + 2}–${region.r1 + 1})`
        );
      }
      const top = extractTable(
        matrix,
        { ...region, r1: splitRow - 1 },
        { id: table.id, name: table.name, index: tableIndex, company: table.company }
      );
      const bottom = extractTable(matrix, { ...region, r0: splitRow }, { index: tableIndex + 1 });
      reapplyComputedColumns(top, table.computedColumns);
      newTables = [applySimpleFields(top, patch), bottom];
    } else if (patch.mergeWithTableId !== undefined) {
      const other = sheet.tables.find((t) => t.id === patch.mergeWithTableId);
      if (!other) throw new CorrectionError("TABLE_NOT_FOUND", "Merge target not found on this sheet");
      const a = regionOf(table);
      const b = regionOf(other);
      const union: Region = {
        r0: Math.min(a.r0, b.r0),
        c0: Math.min(a.c0, b.c0),
        r1: Math.max(a.r1, b.r1),
        c1: Math.max(a.c1, b.c1),
      };
      const merged = extractTable(matrix, union, {
        id: table.id,
        name: table.name,
        index: tableIndex,
        headerRowCount: patch.headerRowCount,
        company: table.company,
      });
      reapplyComputedColumns(merged, table.computedColumns);
      sheet.tables = sheet.tables.filter((t) => t.id !== other.id);
      newTables = [applySimpleFields(merged, patch)];
    } else {
      // range and/or headerRowCount
      let region = regionOf(table);
      if (patch.range) {
        const r = XLSX.utils.decode_range(patch.range.toUpperCase());
        region = clampRegion({ r0: r.s.r, c0: r.s.c, r1: r.e.r, c1: r.e.c }, matrix.rows, matrix.cols);
      }
      const reExtracted = extractTable(matrix, region, {
        id: table.id,
        name: table.name,
        title: table.title,
        index: tableIndex,
        headerRowCount: patch.headerRowCount,
        company: table.company,
      });
      reapplyComputedColumns(reExtracted, table.computedColumns);
      newTables = [applySimpleFields(reExtracted, patch)];
    }
  }

  const idx = sheet.tables.findIndex((t) => t.id === tableId);
  sheet.tables = [...sheet.tables.slice(0, idx), ...newTables, ...sheet.tables.slice(idx + 1)];
  return parsed;
}
