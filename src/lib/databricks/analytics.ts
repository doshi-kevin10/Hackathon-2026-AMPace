import { executeStatement } from "./client";
import { pullLiveTable, type LiveTable } from "./sync";

/**
 * Read-only analytics access over Kevin's Databricks workspace. One dataset =
 * one company table (managed `excel_company_` prefix). The frontend never sends
 * a table name that isn't first validated against this allowlist, and never
 * sends SQL.
 */
const CATALOG = process.env.DATABRICKS_CATALOG ?? "dev_catalog_for_individual_use";
const SCHEMA = process.env.DATABRICKS_SCHEMA ?? "kevin_dev";
const DATASET_PREFIX = "excel_company_";

// Table names are simple identifiers; anything else can't be a real managed table.
const VALID_NAME = /^[a-z0-9_]+$/;

export interface Dataset {
  /** Databricks table name (also the URL slug). */
  name: string;
  /** Company display name, e.g. "AA", "Groupon". */
  label: string;
  fqn: string;
  /** Total rows in the table (whole dataset, not preview-capped). */
  rowCount: number;
  /** Most recent Date in the table (ISO), or null. */
  latestDate: string | null;
}

// Short all-letter tokens are acronyms (aa→AA, bbb→BBB); others title-case.
const titleToken = (t: string): string =>
  /^[a-z]{1,3}$/.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);

const prettify = (table: string): string =>
  table.replace(new RegExp(`^${DATASET_PREFIX}`), "").split("_").filter(Boolean).map(titleToken).join(" ").trim();

export const isValidDatasetName = (name: string): boolean =>
  VALID_NAME.test(name) && name.startsWith(DATASET_PREFIX);

/** List the company datasets with a cheap freshness summary (single union query). */
export async function listDatasets(): Promise<Dataset[]> {
  const { rows } = await executeStatement(
    `SHOW TABLES IN \`${CATALOG}\`.\`${SCHEMA}\` LIKE '${DATASET_PREFIX}*'`
  );
  const names = rows
    .map((r) => String(r[1]))
    .filter((name) => VALID_NAME.test(name) && name.startsWith(DATASET_PREFIX))
    .sort();
  if (names.length === 0) return [];

  // One round trip for all per-company stats (names are allowlisted, safe to interpolate).
  const union = names
    .map((n) => `SELECT '${n}' AS t, COUNT(*) AS c, CAST(MAX(Date) AS STRING) AS d FROM \`${CATALOG}\`.\`${SCHEMA}\`.\`${n}\``)
    .join(" UNION ALL ");
  const stats = new Map<string, { c: number; d: string | null }>();
  try {
    const res = await executeStatement(union);
    for (const [t, c, d] of res.rows) stats.set(String(t), { c: Number(c), d: d ? String(d) : null });
  } catch {
    // Stats are decorative; fall back to zero if the summary query fails.
  }

  return names.map((name) => ({
    name,
    label: prettify(name),
    fqn: `${CATALOG}.${SCHEMA}.${name}`,
    rowCount: stats.get(name)?.c ?? 0,
    latestDate: stats.get(name)?.d ?? null,
  }));
}

/** Current canonical-metric rows for one dataset (live from Databricks). */
export async function getDatasetRows(name: string): Promise<LiveTable & { label: string }> {
  if (!isValidDatasetName(name)) {
    throw new Error(`Unknown dataset "${name}"`);
  }
  const live = await pullLiveTable(name);
  return { ...live, label: prettify(name) };
}
