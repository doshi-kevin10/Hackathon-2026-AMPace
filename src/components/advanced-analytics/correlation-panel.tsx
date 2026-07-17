"use client";

import { useEffect, useRef, useState } from "react";
import type { CorrelationBundle } from "@/lib/analytics/engine";
import type { CanonicalMetricId } from "@/lib/analytics/request-schemas";
import { fetchCorrelation } from "@/lib/client-analytics";
import { METRIC_OPTIONS } from "./fmt";

const selectCls = "h-8 rounded-md border border-border bg-background px-2 text-sm";

function Scatter({ points }: { points: { a: number; b: number }[] }) {
  if (points.length < 2) return null;
  const W = 320;
  const H = 200;
  const P = 8;
  const as = points.map((p) => p.a);
  const bs = points.map((p) => p.b);
  const [aMin, aMax] = [Math.min(...as), Math.max(...as)];
  const [bMin, bMax] = [Math.min(...bs), Math.max(...bs)];
  const x = (a: number) => P + ((a - aMin) / (aMax - aMin || 1)) * (W - 2 * P);
  const y = (b: number) => H - P - ((b - bMin) / (bMax - bMin || 1)) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label="Scatter plot">
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--border)" />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.a)} cy={y(p.b)} r={2.5} fill="var(--chart-1)" opacity={0.6} />
      ))}
    </svg>
  );
}

export function CorrelationPanel({ company, from, to }: { company: string; from?: string; to?: string }) {
  const [metricA, setMetricA] = useState<CanonicalMetricId>("total_adspend");
  const [metricB, setMetricB] = useState<CanonicalMetricId>("revenue");
  const [data, setData] = useState<CorrelationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    const run = () => {
      setLoading(true);
      setError(null);
      fetchCorrelation(company, { metricA, metricB, from, to }, c.signal)
        .then((d) => setData(d))
        .catch((e) => e?.name !== "AbortError" && setError(e instanceof Error ? e.message : "Failed"))
        .finally(() => c.signal.aborted || setLoading(false));
    };
    run();
    return () => c.abort();
  }, [company, metricA, metricB, from, to]);

  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(3));

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">Correlation explorer</h3>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select className={selectCls} value={metricA} onChange={(e) => setMetricA(e.target.value as CanonicalMetricId)}>
          {METRIC_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <span className="text-muted-foreground">vs</span>
        <select className={selectCls} value={metricB} onChange={(e) => setMetricB(e.target.value as CanonicalMetricId)}>
          {METRIC_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Computing…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data && !data.sufficient ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{data.warning}</p>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Scatter points={data.scatter} />
          </div>
          <dl className="grid grid-cols-2 gap-y-2 self-start text-sm">
            <dt className="text-muted-foreground">Pearson r</dt>
            <dd className="text-right font-medium tabular-nums">{fmt(data.pearson)}</dd>
            <dt className="text-muted-foreground">Spearman ρ</dt>
            <dd className="text-right font-medium tabular-nums">{fmt(data.spearman)}</dd>
            <dt className="text-muted-foreground">Samples</dt>
            <dd className="text-right font-medium tabular-nums">{data.n}</dd>
            {data.bestLag && (
              <>
                <dt className="text-muted-foreground">Best lag</dt>
                <dd className="text-right font-medium tabular-nums">
                  {data.bestLag.lag}d (r={fmt(data.bestLag.r)})
                </dd>
              </>
            )}
          </dl>
        </div>
      ) : null}

      {data?.sufficient && <p className="mt-3 text-[11px] text-muted-foreground">⚠ {data.warning}</p>}
    </div>
  );
}
