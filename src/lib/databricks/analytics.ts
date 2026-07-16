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

// Demo differentiation: these companies track CPA (cost per acquisition) instead
// of ROAS. Purely a read-layer relabel + recompute — Databricks is never changed.
const CPA_COMPANIES = new Set(["excel_company_bbb", "excel_company_groupon"]);
export const usesCpa = (name: string): boolean => CPA_COMPANIES.has(name);

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
  /** Average ROAS across the dataset (card summary), or null. */
  avgRoas: number | null;
  /** Average CPA (spend / conversions), for companies that track CPA. */
  avgCpa: number | null;
  /** True when this company's headline metric is CPA instead of ROAS. */
  usesCpa: boolean;
  /** Total ad spend across the dataset (card summary), or null. */
  totalAdspend: number | null;
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
    .map(
      (n) =>
        `SELECT '${n}' AS t, COUNT(*) AS c, CAST(MAX(Date) AS STRING) AS d, ` +
        `ROUND(AVG(ROAS),2) AS r, ROUND(SUM(Total_Adspend)) AS s, ` +
        `ROUND(AVG(Total_Adspend / NULLIF(Conversions,0)),2) AS cpa ` +
        `FROM \`${CATALOG}\`.\`${SCHEMA}\`.\`${n}\``
    )
    .join(" UNION ALL ");
  const stats = new Map<string, { c: number; d: string | null; r: number | null; s: number | null; cpa: number | null }>();
  try {
    const res = await executeStatement(union);
    for (const [t, c, d, r, s, cpa] of res.rows) {
      stats.set(String(t), {
        c: Number(c),
        d: d ? String(d) : null,
        r: r != null ? Number(r) : null,
        s: s != null ? Number(s) : null,
        cpa: cpa != null ? Number(cpa) : null,
      });
    }
  } catch {
    // Stats are decorative; fall back to nulls if the summary query fails.
  }

  return names.map((name) => {
    const st = stats.get(name);
    return {
      name,
      label: prettify(name),
      fqn: `${CATALOG}.${SCHEMA}.${name}`,
      rowCount: st?.c ?? 0,
      latestDate: st?.d ?? null,
      avgRoas: st?.r ?? null,
      avgCpa: st?.cpa ?? null,
      usesCpa: usesCpa(name),
      totalAdspend: st?.s ?? null,
    };
  });
}

/**
 * For CPA companies, relabel the ROAS column to CPA and replace its values with
 * real CPA (spend / conversions), formatted as currency. Read-layer only — the
 * Databricks table is untouched.
 */
function relabelRoasToCpa(live: LiveTable): void {
  const roas = live.columns.find((c) => c.name === "ROAS");
  const adspend = live.columns.find((c) => c.name === "Total Adspend");
  const conv = live.columns.find((c) => c.name === "Conversions");
  if (!roas || !adspend || !conv) return;

  roas.name = "CPA";
  roas.inferredType = "currency";
  for (const row of live.rows) {
    const a = Number(row[adspend.id]?.normalized);
    const c = Number(row[conv.id]?.normalized);
    const cpa = Number.isFinite(a) && c > 0 ? a / c : null;
    row[roas.id] = {
      raw: cpa,
      normalized: cpa,
      display: cpa == null ? null : `$${cpa.toLocaleString("en", { maximumFractionDigits: 2 })}`,
      formula: null,
      type: cpa == null ? "empty" : "currency",
    };
  }
}

/** Current canonical-metric rows for one dataset (live from Databricks). */
export async function getDatasetRows(name: string): Promise<LiveTable & { label: string }> {
  if (!isValidDatasetName(name)) {
    throw new Error(`Unknown dataset "${name}"`);
  }
  const live = await pullLiveTable(name);
  if (usesCpa(name)) relabelRoasToCpa(live);
  return { ...live, label: prettify(name) };
}
