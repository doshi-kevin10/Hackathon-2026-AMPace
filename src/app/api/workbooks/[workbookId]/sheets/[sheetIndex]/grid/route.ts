import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { apiError } from "@/lib/api";
import { config } from "@/lib/config";
import { matrixForSheet, WorkbookParseError } from "@/lib/excel/parse-workbook";
import { isEmptyCell } from "@/lib/excel/types";
import { SheetGridSchema } from "@/lib/schemas/workbook";
import { loadOriginal, loadParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

/** Raw spreadsheet grid (display text only) for the sheet view, capped for the browser. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workbookId: string; sheetIndex: string }> }
) {
  const { workbookId, sheetIndex } = await params;
  const index = Number(sheetIndex);
  if (!Number.isInteger(index) || index < 0) return apiError("INVALID_REQUEST", "Bad sheet index", 400);

  const [parsed, original] = await Promise.all([
    loadParsed(workbookId).catch(() => null),
    loadOriginal(workbookId),
  ]);
  if (!parsed || !original) {
    return apiError("NOT_FOUND", "Workbook not found (uploads expire after 24h)", 404);
  }
  const sheet = parsed.sheets.find((s) => s.index === index);
  if (!sheet) return apiError("NOT_FOUND", "Sheet not found", 404);

  try {
    const matrix = matrixForSheet(original, index);
    const rows = Math.min(matrix.rows, config.gridMaxRows);
    const cols = Math.min(matrix.cols, config.gridMaxCols);
    const cells: (string | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = matrix.cells[r]?.[c];
        row.push(isEmptyCell(cell) ? null : String(cell!.w ?? cell!.v));
      }
      cells.push(row);
    }

    return NextResponse.json(
      SheetGridSchema.parse({
        sheetName: sheet.name,
        cells,
        totalRows: matrix.rows,
        totalColumns: matrix.cols,
        truncated: rows < matrix.rows || cols < matrix.cols,
        merges: matrix.merges.map((m) =>
          XLSX.utils.encode_range({ r: m.r0, c: m.c0 }, { r: m.r1, c: m.c1 })
        ),
        tables: sheet.tables.map((t) => ({
          id: t.id,
          name: t.name,
          source: t.source,
          headerRows: t.headerRows,
          excluded: t.excluded,
        })),
      })
    );
  } catch (err) {
    if (err instanceof WorkbookParseError) return apiError(err.code, err.message, 400);
    return apiError("GRID_FAILED", "Could not build the sheet grid", 500);
  }
}
