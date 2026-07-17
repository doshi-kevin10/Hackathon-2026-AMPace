"use client";

import type { MetricBaseline } from "@/lib/analytics/baseline";
import type { TrendView } from "@/lib/analytics/engine";
import { CANONICAL_FIELDS } from "@/lib/metrics/canonical-registry";
import { Badge } from "@/components/ui/badge";
import { formatMetric, formatPct } from "./fmt";

const trendBadge = (dir: TrendView["direction"]) =>
  dir === "increasing" ? { variant: "secondary" as const, label: "▲ rising" } : dir === "decreasing" ? { variant: "outline" as const, label: "▼ falling" } : { variant: "ghost" as const, label: "→ flat" };

/** Baseline statistics + trend per metric. */
export function StatsPanel({ baseline, trends }: { baseline: MetricBaseline[]; trends: TrendView[] }) {
  const trendByField = new Map(trends.map((t) => [t.field, t]));
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Baseline &amp; trend</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 text-right font-medium">Mean</th>
              <th className="px-3 py-2 text-right font-medium">Median</th>
              <th className="px-3 py-2 text-right font-medium">Min</th>
              <th className="px-3 py-2 text-right font-medium">Max</th>
              <th className="px-3 py-2 text-right font-medium">Std dev</th>
              <th className="px-3 py-2 text-right font-medium">Volatility</th>
              <th className="px-3 py-2 text-right font-medium">Recent avg</th>
              <th className="px-3 py-2 font-medium">Trend</th>
              <th className="px-3 py-2 text-right font-medium">Δ over period</th>
            </tr>
          </thead>
          <tbody>
            {baseline.map((b) => {
              const t = trendByField.get(b.field);
              const badge = trendBadge(t?.direction ?? "flat");
              const recent = b.rolling[0];
              return (
                <tr key={b.field} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{CANONICAL_FIELDS[b.field].displayName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b.field, b.mean)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b.field, b.median)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b.field, b.min)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b.field, b.max)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b.field, b.stddev)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPct(b.volatility)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b.field, recent?.movingAverage ?? null)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPct(t?.percentChange ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Recent avg = trailing {baseline[0]?.rolling[0]?.window ?? 7}-point moving average. Trend is flat below a 5% change over the period.
      </p>
    </div>
  );
}
