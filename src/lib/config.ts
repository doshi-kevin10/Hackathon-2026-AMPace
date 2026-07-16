const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/** All limits are env-overridable so they can be tuned without code changes. */
export const config = {
  /** Max upload size in MB. */
  maxFileMb: int(process.env.EXCEL_MAX_FILE_MB, 20),
  /** Rows kept per sheet before truncation. */
  maxRowsPerSheet: int(process.env.EXCEL_MAX_ROWS_PER_SHEET, 50_000),
  /** Cells kept per sheet before truncation. */
  maxCellsPerSheet: int(process.env.EXCEL_MAX_CELLS_PER_SHEET, 2_000_000),
  /** Rows per table returned in workbook GET responses (full data via export). */
  previewRows: int(process.env.EXCEL_PREVIEW_ROWS, 1000),
  /** Raw grid view caps. */
  gridMaxRows: int(process.env.EXCEL_GRID_MAX_ROWS, 300),
  gridMaxCols: int(process.env.EXCEL_GRID_MAX_COLS, 80),
  /** Hours before stored workbooks are swept. */
  retentionHours: int(process.env.EXCEL_RETENTION_HOURS, 24),
};
