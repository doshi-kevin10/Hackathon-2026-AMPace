"use client";

import type { AnomalyEvent } from "@/lib/analytics/robust-anomalies";
import { CANONICAL_FIELDS } from "@/lib/metrics/canonical-registry";
import { Badge } from "@/components/ui/badge";
import { formatMetric } from "./fmt";

const sevVariant = (s: AnomalyEvent["severity"]) => (s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline");
const methodLabel: Record<AnomalyEvent["method"], string> = { robust_z: "robust z-score", zero_value: "unexpected zero" };

/** Deterministically-detected unusual points. Capped so the panel isn't flooded. */
export function AnomaliesPanel({ anomalies, limit = 12 }: { anomalies: AnomalyEvent[]; limit?: number }) {
  const shown = anomalies.slice(0, limit);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Anomalies</h3>
        <span className="text-xs text-muted-foreground">{anomalies.length} detected</span>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No unusual behaviour detected in this range.</p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((a) => {
            const meta = CANONICAL_FIELDS[a.field];
            return (
              <li key={`${a.field}:${a.date}:${a.method}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm">
                <Badge variant={sevVariant(a.severity)}>{a.severity}</Badge>
                <span className="font-medium">{meta.displayName}</span>
                <span className="text-muted-foreground">{a.date}</span>
                <span className="tabular-nums">{formatMetric(a.field, a.value)}</span>
                {a.expectedLow != null && a.expectedHigh != null && (
                  <span className="text-xs text-muted-foreground">
                    expected {formatMetric(a.field, a.expectedLow)}–{formatMetric(a.field, a.expectedHigh)}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">{methodLabel[a.method]}</span>
                <p className="w-full text-[11px] text-muted-foreground">{a.context}</p>
              </li>
            );
          })}
        </ul>
      )}
      {anomalies.length > limit && <p className="mt-1 text-[11px] text-muted-foreground">Showing the {limit} most severe of {anomalies.length}.</p>}
    </div>
  );
}
