import * as XLSX from "xlsx";
import type { ParsedSheet, ParsedWorkbook, ParserWarning, SheetVisibility } from "@/lib/schemas/workbook";
import { sheetToMatrix } from "./cell-matrix";
import { detectTables } from "./detect-tables";
import { extractTable } from "./normalize-table";
import type { CellMatrix } from "./types";

export class WorkbookParseError extends Error {
  constructor(
    public code:
      | "PASSWORD_PROTECTED"
      | "CORRUPT_WORKBOOK"
      | "EMPTY_WORKBOOK"
      | "PARSE_FAILED",
    message: string
  ) {
    super(message);
    this.name = "WorkbookParseError";
  }
}

/**
 * Real Excel files are either ZIP containers (.xlsx, PK..) or CFB containers
 * (.xls and encrypted .xlsx, D0 CF 11 E0). Without this check SheetJS would
 * happily "parse" arbitrary bytes as CSV/text.
 */
const hasExcelSignature = (b: Buffer | Uint8Array): boolean =>
  (b[0] === 0x50 && b[1] === 0x4b) ||
  (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);

/**
 * Read a workbook from a buffer. Formulas are NEVER evaluated — SheetJS only
 * exposes formula text plus the value cached in the file. Macros are ignored
 * (and .xlsm/.xlsb are rejected at upload time).
 */
export function readWorkbook(buf: Buffer | Uint8Array): XLSX.WorkBook {
  if (buf.length < 8 || !hasExcelSignature(buf)) {
    throw new WorkbookParseError("CORRUPT_WORKBOOK", "The file is not a valid Excel workbook");
  }
  try {
    const wb = XLSX.read(buf, {
      type: "buffer",
      cellNF: true, // number formats, needed for currency/percentage/date inference
      cellText: true, // formatted display strings
      cellStyles: true, // hidden row/col flags
      cellDates: false,
    });
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new WorkbookParseError("EMPTY_WORKBOOK", "The workbook contains no sheets");
    }
    return wb;
  } catch (err) {
    if (err instanceof WorkbookParseError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/password|encrypt/i.test(msg)) {
      throw new WorkbookParseError("PASSWORD_PROTECTED", "The workbook is password-protected");
    }
    throw new WorkbookParseError("CORRUPT_WORKBOOK", `The file could not be read as an Excel workbook: ${msg}`);
  }
}

const visibilityOf = (wb: XLSX.WorkBook, index: number): SheetVisibility => {
  const hidden = wb.Workbook?.Sheets?.[index]?.Hidden ?? 0;
  return hidden === 2 ? "veryHidden" : hidden === 1 ? "hidden" : "visible";
};

/** Rebuild the cell matrix for one sheet of a stored workbook (grid view, corrections). */
export function matrixForSheet(buf: Buffer | Uint8Array, sheetIndex: number): CellMatrix {
  const wb = readWorkbook(buf);
  const name = wb.SheetNames[sheetIndex];
  if (name == null) throw new WorkbookParseError("PARSE_FAILED", `No sheet at index ${sheetIndex}`);
  return sheetToMatrix(wb.Sheets[name], name);
}

/** Full pipeline: workbook buffer → ParsedWorkbook (all sheets, all tables). */
export function parseWorkbook(buf: Buffer | Uint8Array, filename: string, id: string): ParsedWorkbook {
  const started = performance.now();
  const wb = readWorkbook(buf);

  const sheets: ParsedSheet[] = wb.SheetNames.map((name, index) => {
    const matrix = sheetToMatrix(wb.Sheets[name], name);
    const warnings: ParserWarning[] = [];

    if (matrix.truncated) {
      warnings.push({
        code: "SHEET_TRUNCATED",
        message: "Sheet exceeded size limits; extra rows were ignored",
        severity: "warning",
      });
    }

    const { candidates, warnings: detectionWarnings } = detectTables(matrix);
    warnings.push(...detectionWarnings);
    if (candidates.length === 0) {
      warnings.push({ code: "EMPTY_SHEET", message: "No data found on this sheet", severity: "info" });
    }

    const tables = candidates.map((cand, i) =>
      extractTable(matrix, cand.region, { index: i, title: cand.title })
    );

    return {
      id: `s${index}`,
      name,
      index,
      visibility: visibilityOf(wb, index),
      rowCount: matrix.rows,
      columnCount: matrix.cols,
      hiddenRows: matrix.hiddenRows,
      hiddenColumns: matrix.hiddenCols,
      merges: matrix.merges.map((m) =>
        XLSX.utils.encode_range({ r: m.r0, c: m.c0 }, { r: m.r1, c: m.c1 })
      ),
      tables,
      warnings,
    };
  });

  return {
    id,
    filename,
    uploadedAt: new Date().toISOString(),
    parseTimeMs: Math.round(performance.now() - started),
    sheets,
    warnings: [],
  };
}
