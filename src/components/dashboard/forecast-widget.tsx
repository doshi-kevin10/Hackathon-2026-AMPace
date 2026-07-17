"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/line-chart";
import { fmtFor } from "@/components/dashboard/widget-card";
import type { Table } from "@/lib/dashboard/compute";
import { buildForecast } from "@/lib/dashboard/forecast";
import { comparableMetrics } from "@/lib/dashboard/momentum";
import { colorForMetric } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

const FORECAST_COLOR = "var(--chart-4)";

/** Chatbot-triggered 2-week forecast: actuals + a Holt-Winters projection, with a headline stat. */
export function ForecastWidget({ table, metric: initial }: { table: Table; metric?: string }) {
  const metrics = useMemo(() => comparableMetrics(table), [table]);
  const [picked, setPicked] = useState<string | null>(null);
  const metric =
    picked && metrics.includes(picked)
      ? picked
      : initial && metrics.includes(initial)
        ? initial
        : metrics.includes("Revenue")
          ? "Revenue"
          : metrics[0] ?? "";

  const fc = useMemo(() => (metric ? buildForecast(table, metric, 14, 30) : null), [table, metric]);

  if (!metrics.length) return <p className="text-sm text-muted-foreground">No forecastable metrics for this company.</p>;

  const fmt = fmtFor(metric);
  const up = fc?.pct != null && fc.pct > 0;
  const down = fc?.pct != null && fc.pct < 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            aria-label="Forecast metric"
            value={metric}
            onChange={(e) => setPicked(e.target.value)}
            className="-ml-1 rounded-md border-0 bg-transparent px-1 py-0.5 text-sm font-semibold tracking-tight outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {metrics.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            next 14 days · Holt-Winters
          </span>
        </div>
        {fc && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{fc.additive ? "Projected next 14d" : "Projected avg"}</div>
            <div className="flex items-center justify-end gap-1.5 tabular-nums">
              <span className="text-lg font-semibold tracking-tight">{fmt(fc.projected)}</span>
              {fc.pct != null && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-xs font-medium",
                    up && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    down && "bg-red-500/10 text-red-600 dark:text-red-400",
                    !up && !down && "bg-muted text-muted-foreground"
                  )}
                >
                  {fc.pct > 0 ? "▲ +" : fc.pct < 0 ? "▼ " : ""}
                  {(fc.pct * 100).toFixed(1)}% vs prior 14d
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {fc ? (
        <>
          <LineChart
            labels={fc.labels}
            height={240}
            formatValue={fmt}
            series={[
              { id: "actual", name: "Actual", color: colorForMetric(metric), points: fc.actual },
              { id: "forecast", name: "Forecast (next 14d)", color: FORECAST_COLOR, points: fc.forecast },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Projection from weekly-seasonal Holt-Winters over recent history. Reflects your Data-tab edits; not financial advice.
          </p>
        </>
      ) : (
        <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Need at least two weeks of history to forecast {metric}.
        </div>
      )}
    </div>
  );
}
