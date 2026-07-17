"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { PeriodComparison } from "@/lib/analytics/comparison";
import { CANONICAL_FIELDS } from "@/lib/metrics/canonical-registry";
import { formatMetric, formatPct, formatSigned, sentimentClass } from "./fmt";

/** Direction-aware KPI comparison cards. An increase is never assumed to be good. */
export function ComparisonCards({ comparison }: { comparison: PeriodComparison }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Period comparison</h3>
        {comparison.comparison && (
          <p className="text-xs text-muted-foreground">
            {comparison.current.from}…{comparison.current.to} vs {comparison.comparison.from}…{comparison.comparison.to}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {comparison.metrics.map((m) => {
          const meta = CANONICAL_FIELDS[m.field];
          const Icon = m.sentiment === "neutral" ? Minus : (m.percentChange ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <div key={m.field} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{meta.displayName}</p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{formatMetric(m.field, m.currentValue)}</p>
              <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${sentimentClass(m.sentiment)}`}>
                <Icon className="size-3" aria-hidden />
                <span className="tabular-nums">{formatPct(m.percentChange)}</span>
                <span className="text-muted-foreground/70">·</span>
                <span className="tabular-nums text-muted-foreground">{formatSigned(m.field, m.absoluteChange)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                was {formatMetric(m.field, m.comparisonValue)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
