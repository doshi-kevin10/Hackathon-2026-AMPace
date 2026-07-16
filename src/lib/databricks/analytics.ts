import { executeStatement } from "./client";
import { pullLiveTable, type LiveTable } from "./sync";

/**
 * Read-only analytics access over Kevin's Databricks workspace. Only tables in
 * the approved schema whose names carry the managed `excel_` prefix are
 * listable/queryable — the frontend never sends a table name that isn't first
 * validated against this allowlist, and never sends SQL.
 */
const CATALOG = process.env.DATABRICKS_CATALOG ?? "dev_catalog_for_individual_use";
const SCHEMA = process.env.DATABRICKS_SCHEMA ?? "kevin_dev";
const MANAGED_PREFIX = "excel_";

// Table names are simple identifiers; anything else can't be a real managed table.
const VALID_NAME = /^[a-z0-9_]+$/;

export interface Dataset {
  /** Databricks table name (also the URL slug). */
  name: string;
  /** Human label for cards/headers. */
  label: string;
  fqn: string;
}

const prettify = (table: string): string =>
  table
    .replace(new RegExp(`^${MANAGED_PREFIX}`), "")
    .replace(/^hackathon_spread_sheet_/, "")
    .split("_")
    .filter(Boolean)
    // Short all-letter tokens are acronyms (aa→AA, bbb→BBB); others title-case.
    .map((t) => (/^[a-z]{1,3}$/.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(" ")
    .trim();

/** List the analytics datasets available in the approved schema. */
export async function listDatasets(): Promise<Dataset[]> {
  const { rows } = await executeStatement(
    `SHOW TABLES IN \`${CATALOG}\`.\`${SCHEMA}\` LIKE '${MANAGED_PREFIX}*'`
  );
  // SHOW TABLES columns: database, tableName, isTemporary
  return rows
    .map((r) => String(r[1]))
    .filter((name) => VALID_NAME.test(name) && name.startsWith(MANAGED_PREFIX))
    .sort()
    .map((name) => ({ name, label: prettify(name), fqn: `${CATALOG}.${SCHEMA}.${name}` }));
}

export const isValidDatasetName = (name: string): boolean =>
  VALID_NAME.test(name) && name.startsWith(MANAGED_PREFIX);

/** Current canonical-metric rows for one dataset (live from Databricks). */
export async function getDatasetRows(name: string): Promise<LiveTable & { label: string }> {
  if (!isValidDatasetName(name)) {
    throw new Error(`Unknown dataset "${name}"`);
  }
  const live = await pullLiveTable(name);
  return { ...live, label: prettify(name) };
}
