"use client";

import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import type { SeriesView } from "@/lib/analytics/engine";
import { axisFormatter, colorForField } from "./fmt";

/** Small multiples — one single-axis chart per metric (never a dual-axis combo). */
export function SeriesCharts({ series }: { series: SeriesView[] }) {
  if (series.length === 0) return <p className="text-sm text-muted-foreground">Select at least one metric to chart.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {series.map((s) => {
        const labels = s.points.map((p) => (s.field ? p.label.replace(/^Wk of /, "") : p.label));
        return (
          <div key={s.field} className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs font-medium">{s.label}</p>
            <TimeSeriesChart
              labels={labels}
              series={[{ id: s.field, name: s.label, color: colorForField(s.field), points: s.points.map((p) => p.value) }]}
              height={170}
              formatValue={axisFormatter(s.field)}
            />
          </div>
        );
      })}
    </div>
  );
}
