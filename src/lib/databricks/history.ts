/**
 * Historical daily series for one company, for advanced analytics + forecasting.
 *
 * ONE server-side aggregation query per company yields the canonical daily
 * additive base (ratio-of-sums stays correct downstream). No arbitrary SQL: the
 * only interpolated value is an allowlisted table name (`isValidDatasetName`).
 * The `n` (raw row count per date) both fills `rowCount` and lets us detect
 * duplicate source dates without a second round-trip.
 */
import { isValidDatasetName } from "./analytics";
import { executeStatement } from "./client";
import { isMockEnabled, mockDailySeries } from "./mock-data";
import type { DailyPoint } from "@/lib/analytics/series";

const CATALOG = process.env.DATABRICKS_CATALOG ?? "dev_catalog_for_individual_use";
const SCHEMA = process.env.DATABRICKS_SCHEMA ?? "kevin_dev";

export interface DailySeries {
  name: string;
  points: DailyPoint[];
  /** Source dates that had more than one raw row (aggregated here, flagged for data-quality). */
  duplicateDates: string[];
  latestDate: string | null;
  /** Total raw rows across all dates. */
  rowCount: number;
}

const num = (v: string | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Daily canonical series for `name` (validated), ascending by date. */
export async function getDailySeries(name: string): Promise<DailySeries> {
  if (!isValidDatasetName(name)) throw new Error(`Unknown dataset "${name}"`);
  if (isMockEnabled()) return mockDailySeries(name);

  const fqn = `\`${CATALOG}\`.\`${SCHEMA}\`.\`${name}\``;
  const { rows } = await executeStatement(
    `SELECT CAST(Date AS STRING) d, SUM(Total_Adspend) a, SUM(Clicks) c, ` +
      `SUM(Revenue) r, SUM(Conversions) cv, COUNT(*) n ` +
      `FROM ${fqn} WHERE Date IS NOT NULL GROUP BY Date ORDER BY Date`
  );

  const points: DailyPoint[] = [];
  const duplicateDates: string[] = [];
  let rowCount = 0;

  for (const [d, a, c, r, cv, n] of rows) {
    if (d == null) continue;
    const raw = Number(n) || 0;
    rowCount += raw;
    if (raw > 1) duplicateDates.push(String(d));
    points.push({
      date: String(d).slice(0, 10),
      total_adspend: num(a),
      clicks: num(c),
      revenue: num(r),
      conversions: num(cv),
      rowCount: raw,
    });
  }

  return {
    name,
    points,
    duplicateDates,
    latestDate: points.length ? points[points.length - 1].date : null,
    rowCount,
  };
}
