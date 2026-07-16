import type { AnalyticsTable } from "./chart-data";

export interface KpiTotals {
  adspend: number | null;
  clicks: number | null;
  cpc: number | null;
  revenue: number | null;
  conversions: number | null;
  roas: number | null;
  cvr: number | null;
  /** Total Adspend / Conversions — the metric companies tracking CPA use instead of ROAS. */
  cpa: number | null;
}

/** Aggregate KPIs over a table's rows. Ratios come from totals (not averaged), so they stay correct under filtering. */
export function computeKpiTotals(table: AnalyticsTable): KpiTotals {
  const id = (name: string) => table.columns.find((c) => c.name === name)?.id;
  const sum = (name: string): number | null => {
    const colId = id(name);
    if (!colId) return null;
    let total = 0;
    let seen = false;
    for (const r of table.rows) {
      const v = Number(r[colId]?.normalized);
      if (Number.isFinite(v)) {
        total += v;
        seen = true;
      }
    }
    return seen ? total : null;
  };

  const adspend = sum("Total Adspend");
  const clicks = sum("Clicks");
  const revenue = sum("Revenue");
  const conversions = sum("Conversions");
  const cpc = adspend != null && clicks ? adspend / clicks : null;
  const roas = revenue != null && adspend ? revenue / adspend : null;
  const cvr = conversions != null && clicks ? conversions / clicks : null;
  const cpa = adspend != null && conversions ? adspend / conversions : null;

  return { adspend, clicks, cpc, revenue, conversions, roas, cvr, cpa };
}
