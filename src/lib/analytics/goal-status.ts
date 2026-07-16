import type { Goal } from "@/lib/schemas/goal";
import type { AnalyticsTable } from "./chart-data";

export type GoalBand = "red" | "yellow" | "green";

export interface DayGoalStatus {
  date: string;
  /** The metric's value that day, or null if it couldn't be computed (e.g. zero conversions for CPA). */
  value: number | null;
  band: GoalBand | null;
}

const findCol = (table: AnalyticsTable, name: string) => table.columns.find((c) => c.name === name);

/**
 * Band a value against the target, as a fraction of target (ratio = value / target).
 *
 * ROAS (higher is better) — banded both directions, per the account manager's
 * worked example (target 250): <=40% or >200% of target = red, 40-80% or
 * 140-200% = yellow, 80-140% = green. Far below target is underperforming;
 * far above is treated as equally worth flagging (e.g. spend being left on
 * the table) rather than assumed better without limit.
 *
 * CPA (lower is better) — monotonic: comfortably under target = green, near
 * or somewhat over = yellow, well over = red. No symmetric "too cheap" flag,
 * since a low CPA has no analogous downside.
 */
function bandFor(ratio: number, metric: Goal["metric"]): GoalBand {
  if (metric === "ROAS") {
    if (ratio <= 0.4 || ratio > 2.0) return "red";
    if (ratio <= 0.8 || ratio > 1.4) return "yellow";
    return "green";
  }
  // CPA
  if (ratio > 1.4) return "red";
  if (ratio > 0.8) return "yellow";
  return "green";
}

/**
 * Per-day value + goal band for the chosen metric. ROAS reads the existing
 * column; CPA isn't a stored column (Total Adspend / Conversions), so it's
 * computed on the fly from the two columns that are.
 */
export function computeDailyGoalStatus(table: AnalyticsTable, goal: Goal): DayGoalStatus[] {
  const dateCol = findCol(table, "Date");
  if (!dateCol) return [];

  const roasCol = findCol(table, "ROAS");
  const adspendCol = findCol(table, "Total Adspend");
  const conversionsCol = findCol(table, "Conversions");

  const rows = table.rows.map((row) => {
    const dateCell = row[dateCol.id];
    const iso = typeof dateCell?.normalized === "string" ? dateCell.normalized : null;
    const date = iso ? iso.slice(0, 10) : (dateCell?.display ?? "");

    let value: number | null = null;
    if (goal.metric === "ROAS" && roasCol) {
      const n = Number(row[roasCol.id]?.normalized);
      value = Number.isFinite(n) ? n : null;
    } else if (goal.metric === "CPA" && adspendCol && conversionsCol) {
      const spend = Number(row[adspendCol.id]?.normalized);
      const conversions = Number(row[conversionsCol.id]?.normalized);
      value = Number.isFinite(spend) && Number.isFinite(conversions) && conversions > 0 ? spend / conversions : null;
    }

    const band = value == null ? null : bandFor(value / goal.target, goal.metric);
    return { date, value, band, sortKey: iso ? Date.parse(iso) : 0 };
  });

  return rows.sort((a, b) => a.sortKey - b.sortKey).map(({ date, value, band }) => ({ date, value, band }));
}
