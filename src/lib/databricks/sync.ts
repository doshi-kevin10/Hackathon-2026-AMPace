import { config } from "@/lib/config";
import { isCanonicalTable } from "@/lib/excel/canonicalize";
import type { CellValue, ParsedColumn, ParsedTable, ParsedWorkbook } from "@/lib/schemas/workbook";
import { DatabricksError, executeStatement } from "./client";

/**
 * Every synced table lives in Kevin's dev schema with a fixed 9-column schema
 * (exactly the canonical ad metrics — nothing else is pushed) and an `excel_`
 * name prefix so app-managed tables can never collide with hand-made ones.
 */
const CATALOG = process.env.DATABRICKS_CATALOG ?? "dev_catalog_for_individual_use";
const SCHEMA = process.env.DATABRICKS_SCHEMA ?? "kevin_dev";
const PREFIX = "excel_";

export const DB_COLUMNS: { name: string; canonical: string; sqlType: string }[] = [
  { name: "Date", canonical: "Date", sqlType: "DATE" },
  { name: "Day", canonical: "Day", sqlType: "STRING" },
  { name: "Total_Adspend", canonical: "Total Adspend", sqlType: "DOUBLE" },
  { name: "Clicks", canonical: "Clicks", sqlType: "BIGINT" },
  { name: "CPC", canonical: "CPC", sqlType: "DOUBLE" },
  { name: "Revenue", canonical: "Revenue", sqlType: "DOUBLE" },
  { name: "Conversions", canonical: "Conversions", sqlType: "BIGINT" },
  { name: "ROAS", canonical: "ROAS", sqlType: "DOUBLE" },
  { name: "CVR", canonical: "CVR", sqlType: "DOUBLE" },
];

const INSERT_CHUNK = 250;

if (CATALOG.toLowerCase().startsWith("prod")) {
  throw new Error("Refusing to target a production catalog"); // safety net, prod is read-only
}

export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\.(xlsx|xls)$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "table";

const quoteIdent = (name: string): string => `\`${name.replace(/`/g, "")}\``;

const fqn = (table: string): string =>
  `${quoteIdent(CATALOG)}.${quoteIdent(SCHEMA)}.${quoteIdent(table)}`;

const assertManaged = (table: string): void => {
  if (!table.startsWith(PREFIX)) {
    throw new DatabricksError("FORBIDDEN_TABLE", `Refusing to write to non-${PREFIX} table "${table}"`);
  }
};

// ---------- SQL literal rendering ----------

const sqlString = (s: string): string => `'${s.replace(/'/g, "''").slice(0, 1000)}'`;

const toDateLiteral = (cell: CellValue | undefined): string => {
  const v = cell?.normalized;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return `DATE'${v.slice(0, 10)}'`;
  if (typeof v === "string" && v) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return `DATE'${new Date(t).toISOString().slice(0, 10)}'`;
  }
  return "NULL";
};

const toNumberLiteral = (cell: CellValue | undefined, integer: boolean): string => {
  const n = Number(cell?.normalized);
  if (cell?.normalized == null || !Number.isFinite(n)) return "NULL";
  return integer ? String(Math.round(n)) : String(n);
};

const toStringLiteral = (cell: CellValue | undefined): string => {
  const v = cell?.normalized ?? cell?.display;
  return v == null || v === "" ? "NULL" : sqlString(String(v));
};

/** Build the VALUES tuple for one row against the fixed DB schema. */
export const rowTuple = (row: Record<string, CellValue>, colIds: (string | null)[]): string => {
  const parts = DB_COLUMNS.map((dbCol, i) => {
    const id = colIds[i];
    const cell = id ? row[id] : undefined;
    if (!id || !cell) return "NULL";
    if (dbCol.sqlType === "DATE") return toDateLiteral(cell);
    if (dbCol.sqlType === "BIGINT") return toNumberLiteral(cell, true);
    if (dbCol.sqlType === "DOUBLE") return toNumberLiteral(cell, false);
    return toStringLiteral(cell);
  });
  return `(${parts.join(",")})`;
};

export const createTableSql = (table: string): string => {
  assertManaged(table);
  return `CREATE OR REPLACE TABLE ${fqn(table)} (${DB_COLUMNS.map(
    (c) => `${c.name} ${c.sqlType}`
  ).join(", ")})`;
};

/** Map the fixed DB schema onto a parsed table's column ids (null = column missing). */
export const canonicalColumnIds = (table: ParsedTable): (string | null)[] =>
  DB_COLUMNS.map((dbCol) => table.columns.find((c) => c.name === dbCol.canonical)?.id ?? null);

/**
 * Skip rows that would pollute aggregations: all-NULL spacer rows, and — when
 * the table has a Date column — dateless rows (TOTAL/summary lines in the sheet).
 */
const meaningfulTuples = (table: ParsedTable): string[] => {
  const ids = canonicalColumnIds(table);
  const dateId = ids[0]; // DB_COLUMNS[0] is Date
  const allNull = `(${DB_COLUMNS.map(() => "NULL").join(",")})`;
  return table.rows
    .filter((row) => !dateId || toDateLiteral(row[dateId]) !== "NULL")
    .map((row) => rowTuple(row, ids))
    .filter((t) => t !== allNull);
};

// ---------- sync ----------

export interface SyncResult {
  tableId: string;
  name: string;
  status: "synced" | "skipped" | "failed";
  databricksTable?: string;
  rowCount?: number;
  reason?: string;
}

/** Stable name per table: reuse a previous assignment, else workbook + sheet + table name. */
const assignName = (
  wb: ParsedWorkbook,
  sheetName: string,
  table: ParsedTable,
  used: Set<string>
): string => {
  if (table.databricks?.table) return table.databricks.table;
  const base = `${PREFIX}${slug(wb.filename)}_${slug(sheetName)}_${slug(table.name)}`.slice(0, 100);
  let name = base;
  for (let i = 2; used.has(name); i++) name = `${base}_${i}`;
  return name;
};

/**
 * Push every eligible table (not excluded, maps onto the canonical ad-metrics
 * vocabulary) to Databricks as its own table containing ONLY the 9 canonical
 * columns. Mutates the parsed workbook with the resulting mappings.
 */
export async function syncWorkbookToDatabricks(wb: ParsedWorkbook): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const used = new Set<string>(
    wb.sheets.flatMap((s) => s.tables.flatMap((t) => (t.databricks ? [t.databricks.table] : [])))
  );

  for (const sheet of wb.sheets) {
    for (const table of sheet.tables) {
      if (table.excluded) {
        results.push({ tableId: table.id, name: table.name, status: "skipped", reason: "excluded" });
        continue;
      }
      if (!isCanonicalTable(table)) {
        results.push({
          tableId: table.id,
          name: table.name,
          status: "skipped",
          reason: "no canonical ad-metric columns",
        });
        continue;
      }

      const name = assignName(wb, sheet.name, table, used);
      used.add(name);
      try {
        const tuples = meaningfulTuples(table);
        await executeStatement(createTableSql(name));
        for (let i = 0; i < tuples.length; i += INSERT_CHUNK) {
          await executeStatement(
            `INSERT INTO ${fqn(name)} VALUES ${tuples.slice(i, i + INSERT_CHUNK).join(",")}`
          );
        }
        table.databricks = {
          table: name,
          lastSyncedAt: new Date().toISOString(),
          rowCount: tuples.length,
        };
        results.push({
          tableId: table.id,
          name: table.name,
          status: "synced",
          databricksTable: `${CATALOG}.${SCHEMA}.${name}`,
          rowCount: tuples.length,
        });
      } catch (err) {
        results.push({
          tableId: table.id,
          name: table.name,
          status: "failed",
          reason: err instanceof Error ? err.message : "unknown error",
        });
      }
    }
  }
  return results;
}

// ---------- live pull (Databricks → UI) ----------

export interface LiveTable {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
  databricksTable: string;
  fetchedAt: string;
}

/** Read the current contents of a synced table so the UI reflects Databricks-side updates. */
export async function pullLiveTable(tableName: string): Promise<LiveTable> {
  assertManaged(tableName);
  const { columns, rows } = await executeStatement(
    `SELECT ${DB_COLUMNS.map((c) => c.name).join(", ")} FROM ${fqn(tableName)} ORDER BY Date NULLS LAST LIMIT ${config.previewRows}`
  );

  const parsedColumns: ParsedColumn[] = DB_COLUMNS.map((c, i) => ({
    id: `col_${i + 1}`,
    name: c.canonical,
    originalHeader: null,
    sheetColumn: -1,
    inferredType:
      c.sqlType === "DATE" ? "date" : c.sqlType === "BIGINT" ? "integer" : c.sqlType === "DOUBLE" ? "decimal" : "string",
    typeOverride: null,
    formula: null,
  }));

  const byName = new Map(columns.map((name, i) => [name, i]));
  const outRows = rows.map((raw) => {
    const row: Record<string, CellValue> = {};
    DB_COLUMNS.forEach((c, i) => {
      const idx = byName.get(c.name);
      const v = idx == null ? null : raw[idx];
      const num = v != null && c.sqlType !== "STRING" && c.sqlType !== "DATE" ? Number(v) : null;
      row[`col_${i + 1}`] = {
        raw: v,
        normalized: num ?? v,
        display:
          v == null
            ? null
            : c.canonical === "CVR" && num != null
              ? `${(num * 100).toFixed(2)}%`
              : num != null
                ? num.toLocaleString("en", { maximumFractionDigits: 4 })
                : String(v),
        formula: null,
        type: v == null ? "empty" : parsedColumns[i].inferredType,
      };
    });
    return row;
  });

  return {
    columns: parsedColumns,
    rows: outRows,
    databricksTable: `${CATALOG}.${SCHEMA}.${tableName}`,
    fetchedAt: new Date().toISOString(),
  };
}
