/**
 * Future integration surface (phase 2+): map parsed Excel tables onto external
 * data platforms (Databricks first). Nothing implements this yet — the parsed
 * model already carries the stable ids these mappings will need:
 *
 *   Excel workbook (ParsedWorkbook.id)
 *     → sheet (ParsedSheet.id, stable per workbook)
 *       → detected table (ParsedTable.id, preserved across corrections)
 *         → normalized columns (ParsedColumn.id)
 *           → catalog.schema.table + column mappings (TableMapping)
 */

import type { ColumnType } from "@/lib/schemas/workbook";

export interface ExternalTable {
  /** Fully qualified id, e.g. "catalog.schema.table" on Databricks. */
  id: string;
  name: string;
  description?: string;
}

export interface ExternalColumn {
  name: string;
  /** Platform-native type, e.g. "DECIMAL(18,2)". */
  type: string;
  nullable: boolean;
}

export interface ColumnMapping {
  /** ParsedColumn.id in the source table. */
  sourceColumnId: string;
  targetColumn: string;
  /** Source type at mapping time, for drift detection. */
  sourceType: ColumnType;
}

export interface TableMapping {
  workbookId: string;
  sheetId: string;
  tableId: string;
  /** ExternalTable.id the parsed table should land in. */
  targetTableId: string;
  columns: ColumnMapping[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataSourceAdapter {
  listTables(): Promise<ExternalTable[]>;
  getSchema(tableId: string): Promise<ExternalColumn[]>;
  previewRows(tableId: string, limit: number): Promise<Record<string, unknown>[]>;
  validateMapping(mapping: TableMapping): Promise<ValidationResult>;
}
