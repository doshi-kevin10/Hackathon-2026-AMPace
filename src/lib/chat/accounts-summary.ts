import { detectAnomalies } from "@/lib/analytics/anomalies";
import { computeDailyGoalStatus } from "@/lib/analytics/goal-status";
import { computeKpiTotals } from "@/lib/analytics/kpi";
import { getDatasetRows, listDatasets } from "@/lib/databricks/analytics";
import { getAllGoals } from "@/lib/goals/goal-store";

const fmtUsd = (v: number | null) => (v == null ? "n/a" : `$${v.toLocaleString("en", { maximumFractionDigits: 2 })}`);
const fmtNum = (v: number | null) => (v == null ? "n/a" : v.toLocaleString("en", { maximumFractionDigits: 0 }));
const fmtX = (v: number | null) => (v == null ? "n/a" : `${v.toFixed(2)}×`);
const fmtPct = (v: number | null) => (v == null ? "n/a" : `${(v * 100).toFixed(2)}%`);

/**
 * One text block per account (company/dataset) — current KPIs, goal status
 * over the last 7 days, and recent notable moves. This is the chatbot's
 * entire view of "the data we have"; nothing outside this function's output
 * (and the system prompt) reaches the model.
 */
export async function buildAccountsSummary(): Promise<string> {
  const [datasets, goals] = await Promise.all([listDatasets(), getAllGoals()]);
  if (datasets.length === 0) return "No accounts are available in the workspace.";

  const blocks = await Promise.all(
    datasets.map(async (ds) => {
      try {
        const table = await getDatasetRows(ds.name);
        const kpis = computeKpiTotals(table);
        const goal = goals.get(ds.name) ?? null;
        const anomalies = detectAnomalies(table).slice(0, 3);

        const lines = [
          `### ${ds.label}`,
          `Rows: ${ds.rowCount}, latest data: ${ds.latestDate ?? "unknown"}`,
          `Total Adspend: ${fmtUsd(kpis.adspend)} | Clicks: ${fmtNum(kpis.clicks)} | CPC: ${fmtUsd(kpis.cpc)}`,
          `Revenue: ${fmtUsd(kpis.revenue)} | Conversions: ${fmtNum(kpis.conversions)} | ROAS: ${fmtX(kpis.roas)} | CVR: ${fmtPct(kpis.cvr)}`,
        ];

        if (goal) {
          const status = computeDailyGoalStatus(table, goal).slice(-7);
          const green = status.filter((d) => d.band === "green").length;
          const yellow = status.filter((d) => d.band === "yellow").length;
          const red = status.filter((d) => d.band === "red").length;
          lines.push(
            `Goal: ${goal.metric}, target ${goal.target} (${goal.metric === "ROAS" ? "higher is better, but far above target is flagged too" : "lower is better"}). ` +
              `Last 7 days: ${green} on target, ${yellow} off target, ${red} well off target.`
          );
        } else {
          lines.push("Goal: not set.");
        }

        lines.push(
          anomalies.length > 0
            ? `Recent notable day-over-day moves: ${anomalies
                .map((a) => `${a.columnName} ${a.direction} ${(a.changePct * 100).toFixed(0)}% on ${a.date}`)
                .join("; ")}.`
            : "No unusual day-over-day moves detected recently."
        );

        return lines.join("\n");
      } catch (err) {
        return `### ${ds.label}\nCould not load this account's data (${err instanceof Error ? err.message : "unknown error"}).`;
      }
    })
  );

  return blocks.join("\n\n");
}
