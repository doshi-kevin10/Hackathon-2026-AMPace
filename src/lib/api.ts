import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { ParsedWorkbook } from "@/lib/schemas/workbook";

export const apiError = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message } }, { status });

/** Cap per-table rows for GET responses; full data stays on disk for export. */
export function previewWorkbook(wb: ParsedWorkbook): ParsedWorkbook {
  return {
    ...wb,
    sheets: wb.sheets.map((sheet) => ({
      ...sheet,
      tables: sheet.tables.map((table) =>
        table.rows.length > config.previewRows
          ? { ...table, rows: table.rows.slice(0, config.previewRows), previewTruncated: true }
          : table
      ),
    })),
  };
}
