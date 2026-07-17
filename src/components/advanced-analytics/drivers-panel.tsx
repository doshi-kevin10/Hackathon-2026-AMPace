"use client";

import type { DriverDecomposition } from "@/lib/analytics/drivers";
import { CANONICAL_FIELDS, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import { Badge } from "@/components/ui/badge";
import { formatPct, formatSigned } from "./fmt";

const label = (m: DriverDecomposition["metric"]) => CANONICAL_FIELDS[m as CanonicalFieldId].displayName;

/** Deterministic "why did this metric change?" — exact (LMDI) or labelled approximate. */
export function DriversPanel({ drivers }: { drivers: DriverDecomposition[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Why did it change?</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {drivers.map((d) => {
          const total = d.totalChange ?? 0;
          const maxAbs = Math.max(1e-9, ...d.contributions.map((c) => Math.abs(c.contribution ?? 0)));
          return (
            <div key={d.metric} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{label(d.metric)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Δ {formatSigned(d.metric as CanonicalFieldId, d.totalChange)}
                  </span>
                  <Badge variant={d.method === "exact_lmdi" ? "secondary" : "outline"}>
                    {d.method === "exact_lmdi" ? "exact" : "approximate"}
                  </Badge>
                </div>
              </div>
              <ul className="grid gap-1.5">
                {d.contributions.map((c) => {
                  const contrib = c.contribution;
                  const widthPct = contrib != null ? (Math.abs(contrib) / maxAbs) * 100 : 0;
                  const positive = (contrib ?? c.factorChangePct ?? 0) >= 0;
                  return (
                    <li key={c.factor} className="text-xs">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="text-muted-foreground">{c.factor}</span>
                        <span className="tabular-nums">
                          {contrib != null ? (
                            <>
                              {formatSigned(d.metric as CanonicalFieldId, contrib)}
                              {c.sharePct != null && total !== 0 && (
                                <span className="ml-1 text-muted-foreground/70">({formatPct(c.sharePct)})</span>
                              )}
                            </>
                          ) : (
                            <>{formatPct(c.factorChangePct)}</>
                          )}
                        </span>
                      </div>
                      {contrib != null && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={positive ? "h-full bg-emerald-500/70" : "h-full bg-destructive/70"}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {d.note && <p className="mt-1.5 text-[11px] text-muted-foreground">{d.note}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
