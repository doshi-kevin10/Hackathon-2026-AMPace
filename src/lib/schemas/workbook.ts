import { z } from "zod";

export const COLUMN_TYPES = [
  "string",
  "integer",
  "decimal",
  "currency",
  "percentage",
  "boolean",
  "date",
  "datetime",
  "formula",
  "mixed",
  "empty",
] as const;

export const ColumnTypeSchema = z.enum(COLUMN_TYPES);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

export const ParserWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning"]),
});
export type ParserWarning = z.infer<typeof ParserWarningSchema>;

/** One cell as delivered to the client: raw Excel value + normalized + display text. */
export const CellValueSchema = z.object({
  raw: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  normalized: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  display: z.string().nullable(),
  formula: z.string().nullable(),
  type: ColumnTypeSchema,
});
export type CellValue = z.infer<typeof CellValueSchema>;

export const ParsedColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  originalHeader: z.string().nullable(),
  /** Absolute 0-based column index in the sheet; -1 for computed columns. */
  sheetColumn: z.number().int(),
  inferredType: ColumnTypeSchema,
  typeOverride: ColumnTypeSchema.nullable(),
  /** Formula for computed columns (derived metrics or user-added), else null. */
  formula: z.string().nullable().default(null),
});
export type ParsedColumn = z.infer<typeof ParsedColumnSchema>;

export const TableSourceSchema = z.object({
  startRow: z.number().int(),
  endRow: z.number().int(),
  startColumn: z.number().int(),
  endColumn: z.number().int(),
});
export type TableSource = z.infer<typeof TableSourceSchema>;

export const ParsedTableSchema = z.object({
  id: z.string(),
  sheetName: z.string(),
  name: z.string(),
  /** Title text found above the table, if any. */
  title: z.string().nullable(),
  /** Excel range of the full detected region, e.g. "B3:F20". */
  range: z.string(),
  confidence: z.number().min(0).max(1),
  /** Absolute 0-based sheet row indices used as header rows ([] = no header). */
  headerRows: z.array(z.number().int()),
  columns: z.array(ParsedColumnSchema),
  rows: z.array(z.record(z.string(), CellValueSchema)),
  /** Total data rows in the table (rows may be truncated for previews). */
  rowCount: z.number().int(),
  previewTruncated: z.boolean().optional(),
  excluded: z.boolean(),
  /** User-added formula columns, re-applied whenever the table is re-extracted. */
  computedColumns: z.array(z.object({ name: z.string(), formula: z.string() })).default([]),
  warnings: z.array(ParserWarningSchema),
  source: TableSourceSchema,
});
export type ParsedTable = z.infer<typeof ParsedTableSchema>;

export const SheetVisibilitySchema = z.enum(["visible", "hidden", "veryHidden"]);
export type SheetVisibility = z.infer<typeof SheetVisibilitySchema>;

export const ParsedSheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  index: z.number().int(),
  visibility: SheetVisibilitySchema,
  rowCount: z.number().int(),
  columnCount: z.number().int(),
  hiddenRows: z.array(z.number().int()),
  hiddenColumns: z.array(z.number().int()),
  /** Merged ranges as A1 refs, e.g. "A1:C1". */
  merges: z.array(z.string()),
  tables: z.array(ParsedTableSchema),
  warnings: z.array(ParserWarningSchema),
});
export type ParsedSheet = z.infer<typeof ParsedSheetSchema>;

export const ParsedWorkbookSchema = z.object({
  id: z.string(),
  filename: z.string(),
  uploadedAt: z.string(),
  parseTimeMs: z.number(),
  sheets: z.array(ParsedSheetSchema),
  warnings: z.array(ParserWarningSchema),
});
export type ParsedWorkbook = z.infer<typeof ParsedWorkbookSchema>;

// ---------- API payloads ----------

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const UploadResponseSchema = z.object({
  workbookId: z.string(),
  filename: z.string(),
  sheetCount: z.number().int(),
  tableCount: z.number().int(),
  warningCount: z.number().int(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

const A1_RANGE = /^[A-Za-z]{1,3}[1-9]\d*:[A-Za-z]{1,3}[1-9]\d*$/;

export const TablePatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    excluded: z.boolean().optional(),
    /** New Excel range for the table (triggers re-extraction). */
    range: z.string().regex(A1_RANGE, "Expected an A1 range like B3:F20").optional(),
    /** Number of header rows at the top of the range: 0, 1 or 2 (triggers re-extraction). */
    headerRowCount: z.number().int().min(0).max(2).optional(),
    columns: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().trim().min(1).optional(),
          typeOverride: ColumnTypeSchema.nullable().optional(),
        })
      )
      .optional(),
    /** Add a computed column, Excel-style: name + formula over other columns. */
    addColumn: z
      .object({
        name: z.string().trim().min(1).max(60),
        formula: z.string().trim().min(1).max(200),
      })
      .optional(),
    /** Split: absolute 1-based sheet row where the second table starts. */
    splitAtRow: z.number().int().min(1).optional(),
    /** Merge this table with another detected table on the same sheet. */
    mergeWithTableId: z.string().optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: "Patch must contain at least one field",
  });
export type TablePatch = z.infer<typeof TablePatchSchema>;

export const GridTableOverlaySchema = z.object({
  id: z.string(),
  name: z.string(),
  source: TableSourceSchema,
  headerRows: z.array(z.number().int()),
  excluded: z.boolean(),
});

export const SheetGridSchema = z.object({
  sheetName: z.string(),
  /** Display text per cell, row-major, starting at row 0 / col 0. */
  cells: z.array(z.array(z.string().nullable())),
  totalRows: z.number().int(),
  totalColumns: z.number().int(),
  truncated: z.boolean(),
  merges: z.array(z.string()),
  tables: z.array(GridTableOverlaySchema),
});
export type SheetGrid = z.infer<typeof SheetGridSchema>;
