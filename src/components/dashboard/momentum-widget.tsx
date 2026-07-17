"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fmtFor } from "@/components/dashboard/widget-card";
import type { Table } from "@/lib/dashboard/compute";
import { comparableMetrics, momentum, type Comparison } from "@/lib/dashboard/momentum";
import { colorForMetric } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

/** Two-bar previous→current mini chart. */
function MiniBars({ previous, current, color }: { previous: number | null; current: number | null; color: string }) {
  const max = Math.max(previous ?? 0, current ?? 0, 1);
  const bar = (v: number | null, fill: string, title: string) => (
    <div className="flex flex-1 flex-col items-center justify-end">
      <div
        className="w-full max-w-6 rounded-t"
        style={{ height: `${((v ?? 0) / max) * 100}%`, backgroundColor: fill, minHeight: v ? 2 : 0 }}
        title={title}
      />
    </div>
  );
  return (
    <div className="flex h-10 items-end gap-1.5">
      {bar(previous, "var(--muted-foreground)", "previous")}
      {bar(current, color, "current")}
    </div>
  );
}

function Card({ c, metric }: { c: Comparison; metric: string }) {
  const fmt = fmtFor(metric);
  const up = c.pct != null && c.pct > 0;
  const down = c.pct != null && c.pct < 0;
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {c.title} <span className="normal-case opacity-70">· {c.vs}</span>
      </p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{c.current == null ? "—" : fmt(c.current)}</p>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
            up && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            down && "bg-red-500/10 text-red-600 dark:text-red-400",
            !up && !down && "bg-muted text-muted-foreground"
          )}
        >
          <Arrow className="size-3" />
          {c.pct == null ? "n/a" : `${c.pct >= 0 ? "+" : ""}${(c.pct * 100).toFixed(1)}%`}
        </span>
        <MiniBars previous={c.previous} current={c.current} color={colorForMetric(metric)} />
      </div>
      {c.previous != null && (
        <p className="text-[11px] text-muted-foreground tabular-nums">prev {fmt(c.previous)}</p>
      )}
    </div>
  );
}

/** Always-on period comparison: pick a metric, see today / last 7d / last 30d vs their prior windows. */
export function MomentumWidget({ table }: { table: Table }) {
  const metrics = useMemo(() => comparableMetrics(table), [table]);
  const [picked, setPicked] = useState<string | null>(null);
  const metric = picked && metrics.includes(picked) ? picked : metrics.includes("Revenue") ? "Revenue" : metrics[0] ?? "";
  const comparisons = useMemo(() => (metric ? momentum(table, metric) : []), [table, metric]);

  if (!metrics.length) {
    return <p className="text-sm text-muted-foreground">No comparable metrics for this company.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="momentum-metric">
          Metric
        </label>
        <select
          id="momentum-metric"
          value={metric}
          onChange={(e) => setPicked(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {metrics.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {comparisons.map((c) => (
          <Card key={c.key} c={c} metric={metric} />
        ))}
      </div>
    </div>
  );
}
