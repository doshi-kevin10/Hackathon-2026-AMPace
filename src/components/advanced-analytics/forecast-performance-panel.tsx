"use client";

import { useEffect, useRef, useState } from "react";
import type { ForecastPerformance } from "@/lib/forecasting/service";
import { fetchForecastPerformance } from "@/lib/client-analytics";
import { formatPct } from "./fmt";

/** Historical forecast accuracy — stored forecasts scored against actuals that later arrived. */
export function ForecastPerformancePanel({ company }: { company: string }) {
  const [data, setData] = useState<ForecastPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const c = new AbortController();
    ctrl.current = c;
    const run = () => {
      setLoading(true);
      fetchForecastPerformance(company, c.signal)
        .then((d) => setData(d))
        .catch((e) => e?.name !== "AbortError" && setError(e instanceof Error ? e.message : "Failed"))
        .finally(() => c.signal.aborted || setLoading(false));
    };
    run();
    return () => c.abort();
  }, [company]);

  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-1 text-sm font-semibold">Forecast performance history</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Every saved forecast is re-scored against the actuals that have since arrived — this is how the models earn trust.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data || data.evaluations.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No forecasts have been evaluated yet. Generate forecasts, then revisit after newer actual data lands to see how they held up.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <PerfTable title="By model" rows={data.byModel.map((r) => ({ key: r.model, ...r }))} />
          <PerfTable title="By horizon" rows={data.byHorizon.map((r) => ({ key: `${r.horizonDays}d`, ...r }))} />
        </div>
      )}

      {data && data.evaluations.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {data.evaluations.length} forecast run(s) evaluated. Coverage = share of actuals that fell inside the forecast interval (target ≈ {pct(0.8)}).
        </p>
      )}
    </div>
  );
}

function PerfTable({ title, rows }: { title: string; rows: { key: string; evaluated: number; mae: number | null; wape: number | null; coverage: number | null }[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-2 py-1 font-medium">{title.replace("By ", "")}</th>
              <th className="px-2 py-1 text-right font-medium">n</th>
              <th className="px-2 py-1 text-right font-medium">WAPE</th>
              <th className="px-2 py-1 text-right font-medium">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="px-2 py-1">{r.key}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.evaluated}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatPct(r.wape)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.coverage == null ? "—" : `${(r.coverage * 100).toFixed(0)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
