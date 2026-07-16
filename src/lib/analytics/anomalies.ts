import { dateColumn, lineSeries, numericColumns, type AnalyticsTable } from "./chart-data";

export interface Anomaly {
  /** Stable key so repeated detection runs (and the alert dedup store) can identify the same event. */
  id: string;
  columnId: string;
  columnName: string;
  /** Display label of the date this anomaly occurred on. */
  date: string;
  direction: "jump" | "drop";
  value: number;
  previousValue: number;
  /** Signed fraction, e.g. 0.42 for +42%. */
  changePct: number;
}

const DEFAULT_THRESHOLD = 0.3;

/** Day-over-day jumps/drops beyond `threshold` (default 30%), across every numeric metric with a date axis. */
export function detectAnomalies(table: AnalyticsTable, threshold = DEFAULT_THRESHOLD): Anomaly[] {
  const dateCol = dateColumn(table);
  if (!dateCol) return [];

  const anomalies: Anomaly[] = [];
  for (const col of numericColumns(table)) {
    const points = lineSeries(table, dateCol, col);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1].value;
      const curr = points[i].value;
      if (prev == null || curr == null || prev === 0) continue;
      const changePct = (curr - prev) / Math.abs(prev);
      if (Math.abs(changePct) >= threshold) {
        anomalies.push({
          id: `${col.id}:${points[i].x}`,
          columnId: col.id,
          columnName: col.name,
          date: points[i].x,
          direction: changePct > 0 ? "jump" : "drop",
          value: curr,
          previousValue: prev,
          changePct,
        });
      }
    }
  }
  return anomalies.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}
