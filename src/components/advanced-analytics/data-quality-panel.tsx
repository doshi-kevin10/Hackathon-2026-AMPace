"use client";

import type { DataQualityReport } from "@/lib/analytics/data-quality";
import { Badge } from "@/components/ui/badge";

const scoreColor = (s: number) => (s >= 85 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-destructive");
const sevVariant = (s: DataQualityReport["issues"][number]["severity"]) =>
  s === "critical" ? "destructive" : s === "warning" ? "secondary" : "outline";

/** Data-quality score + specific warnings. Forecasting is gated on this. */
export function DataQualityPanel({ quality }: { quality: DataQualityReport }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Data quality</h3>
        <Badge variant={quality.sufficientForForecast ? "secondary" : "destructive"}>
          {quality.sufficientForForecast ? "OK to forecast" : "Forecasting limited"}
        </Badge>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums">{quality.score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${scoreColor(quality.score)}`} style={{ width: `${quality.score}%` }} />
      </div>

      <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Observations</dt>
          <dd className="font-medium tabular-nums">{quality.observations}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Missing dates</dt>
          <dd className="font-medium tabular-nums">{quality.missingDates.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Largest gap</dt>
          <dd className="font-medium tabular-nums">{quality.largestGapDays}d</dd>
        </div>
      </dl>

      {quality.issues.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data-quality issues detected.</p>
      ) : (
        <ul className="grid gap-1.5">
          {quality.issues.map((i) => (
            <li key={i.code} className="flex items-start gap-2 text-xs">
              <Badge variant={sevVariant(i.severity)}>{i.severity}</Badge>
              <span className="text-muted-foreground">{i.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
