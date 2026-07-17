"use client";

import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { fmtFor } from "@/components/dashboard/widget-card";
import type { Table } from "@/lib/dashboard/compute";
import { comparableMetrics, metricDailySeries, momentum, type Comparison } from "@/lib/dashboard/momentum";
import { cn } from "@/lib/utils";

const UP = "var(--chart-2)"; // green
const DOWN = "var(--chart-8)"; // red

const changeCls = (pct: number | null) =>
  pct == null || pct === 0
    ? "text-muted-foreground"
    : pct > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
const arrow = (pct: number | null) => (pct == null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "▬");
const pctText = (pct: number | null) => (pct == null ? "—" : `${pct > 0 ? "+" : ""}${(pct * 100).toFixed(2)}%`);

const TF_LABEL: Record<Comparison["key"], string> = { day: "1D", week: "7D", month: "30D" };

/** Stock-ticker style period comparison: a live "quote", a trend sparkline, and a 1D/7D/30D strip. */
export function MomentumWidget({ table }: { table: Table }) {
  const metrics = useMemo(() => comparableMetrics(table), [table]);
  const [picked, setPicked] = useState<string | null>(null);
  const metric = picked && metrics.includes(picked) ? picked : metrics.includes("Revenue") ? "Revenue" : metrics[0] ?? "";

  const comparisons = useMemo(() => (metric ? momentum(table, metric) : []), [table, metric]);
  const series = useMemo(() => (metric ? metricDailySeries(table, metric, 30) : []), [table, metric]);

  if (!metrics.length) {
    return <p className="text-sm text-muted-foreground">No comparable metrics for this company.</p>;
  }

  const fmt = fmtFor(metric);
  const day = comparisons.find((c) => c.key === "day");
  const delta = day?.delta ?? null;
  const dayPct = day?.pct ?? null;
  const trendUp = series.length >= 2 ? series[series.length - 1] >= series[0] : true;

  return (
    <div className="flex flex-col gap-3">
      {/* quote header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Metric"
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
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">daily</span>
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{day?.current == null ? "—" : fmt(day.current)}</div>
          <div className={cn("mt-0.5 flex items-center gap-1.5 text-sm font-medium tabular-nums", changeCls(dayPct))}>
            <span aria-hidden>{arrow(dayPct)}</span>
            <span>
              {delta == null ? "—" : `${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}`} ({pctText(dayPct)})
            </span>
            <span className="font-normal text-muted-foreground">today vs yesterday</span>
          </div>
        </div>
      </div>

      {/* trend sparkline */}
      <div>
        <Sparkline points={series} height={64} color={trendUp ? UP : DOWN} />
        <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{series.length ? `${series.length}d ago` : ""}</span>
          <span>{series.length ? "today" : "not enough history for a trend"}</span>
        </div>
      </div>

      {/* 1D / 7D / 30D performance strip */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border pt-2">
        {comparisons.map((c) => (
          <div key={c.key} className="flex flex-col px-3 first:pl-0" title={`${c.title} ${c.vs}`}>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{TF_LABEL[c.key]}</span>
            <span className={cn("mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums", changeCls(c.pct))}>
              <span aria-hidden className="text-[10px]">{arrow(c.pct)}</span>
              {pctText(c.pct)}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{c.current == null ? "—" : fmt(c.current)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
