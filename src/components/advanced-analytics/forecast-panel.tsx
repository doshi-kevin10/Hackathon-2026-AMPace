"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnalyticsBundle } from "@/lib/analytics/engine";
import type { ForecastServiceResult } from "@/lib/forecasting/service";
import { fetchAnalytics, createForecast } from "@/lib/client-analytics";
import { CANONICAL_FIELDS, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import type { CanonicalMetricId } from "@/lib/analytics/request-schemas";
import { axisFormatter, colorForField, formatMetric, formatPct, FORECAST_METRICS } from "./fmt";

const selectCls = "h-8 rounded-md border border-border bg-background px-2 text-sm";
const HORIZONS = [7, 14, 30] as const;
const ADDITIVE = new Set<CanonicalFieldId>(["total_adspend", "clicks", "revenue", "conversions"]);
const MS_DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * MS_DAY).toISOString().slice(0, 10);

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

const confVariant = (c: string) => (c === "high" ? "secondary" : c === "medium" ? "outline" : "destructive");

export function ForecastPanel({ company, latestDate }: { company: string; latestDate: string | null }) {
  const [metric, setMetric] = useState<CanonicalMetricId>("revenue");
  const [horizon, setHorizon] = useState<number>(14);
  const [forecast, setForecast] = useState<ForecastServiceResult | null>(null);
  const [history, setHistory] = useState<AnalyticsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const load = (refresh = false) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError(null);
    const from = latestDate ? addDays(latestDate, -120) : undefined;
    Promise.all([
      createForecast(company, { metric, horizonDays: horizon as 7 | 14 | 30, refresh }, c.signal),
      fetchAnalytics(company, { granularity: "day", metrics: [metric], from, comparisonMode: "previous_period" }, c.signal),
    ])
      .then(([fc, hist]) => {
        if (c.signal.aborted) return;
        setForecast(fc);
        setHistory(hist);
      })
      .catch((e) => e?.name !== "AbortError" && setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => c.signal.aborted || setLoading(false));
  };

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, metric, horizon, latestDate]);

  const meta = CANONICAL_FIELDS[metric];
  const additive = ADDITIVE.has(metric);

  const exportCsv = () => {
    if (!forecast?.result) return;
    const rows = [["date", "predicted", "lower", "upper"], ...forecast.result.points.map((p) => [p.date, String(p.predicted), String(p.lowerBound), String(p.upperBound)])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${company}_${metric}_${horizon}d_forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">Forecast</h3>
        <select className={selectCls} value={metric} onChange={(e) => setMetric(e.target.value as CanonicalMetricId)} aria-label="Forecast metric">
          {FORECAST_METRICS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <select className={selectCls} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="Forecast horizon">
          {HORIZONS.map((h) => (
            <option key={h} value={h}>{h} days</option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {loading && !forecast ? (
        <p className="text-sm text-muted-foreground">Fitting models &amp; back-testing…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : forecast?.status === "insufficient" ? (
        <div className="rounded-md border border-dashed p-4 text-sm">
          <p className="font-medium text-foreground">Forecasting is disabled for this selection.</p>
          <p className="mt-1 text-muted-foreground">{forecast.reason}</p>
          {forecast.allowedHorizons && forecast.allowedHorizons.length > 0 && (
            <p className="mt-1 text-muted-foreground">Supported horizons for this data: {forecast.allowedHorizons.join(", ")} days.</p>
          )}
        </div>
      ) : forecast?.result && history ? (
        <ForecastView metric={metric} additive={additive} result={forecast.result} models={forecast.competingModels ?? []} history={history} horizon={horizon} onExport={exportCsv} />
      ) : null}
    </div>
  );

  // Split out to keep the JSX readable.
  function ForecastView({
    result,
    models,
    history,
    horizon,
    additive,
    metric,
    onExport,
  }: {
    result: NonNullable<ForecastServiceResult["result"]>;
    models: NonNullable<ForecastServiceResult["competingModels"]>;
    history: AnalyticsBundle;
    horizon: number;
    additive: boolean;
    metric: CanonicalFieldId;
    onExport: () => void;
  }) {
    const hist = history.series[0]?.points ?? [];
    const tail = hist.slice(-Math.max(30, horizon * 3));
    const histLabels = tail.map((p) => p.key);
    const histValues = tail.map((p) => p.value);
    const lastActualIdx = histValues.length - 1;
    const lastActual = histValues[lastActualIdx] ?? null;

    const fPred = result.points.map((p) => p.predicted);
    const fLower = result.points.map((p) => p.lowerBound);
    const fUpper = result.points.map((p) => p.upperBound);
    const fLabels = result.points.map((p) => p.date.slice(5)); // MM-DD

    const labels = [...histLabels, ...fLabels];
    const historicalSeries = { id: "actual", name: "Actual", color: colorForField(metric), points: [...histValues, ...fPred.map(() => null)] };
    const forecastSeries = {
      id: "forecast",
      name: "Forecast",
      color: "var(--muted-foreground)",
      dashed: true,
      points: [...histValues.map((_, i) => (i === lastActualIdx ? lastActual : null)), ...fPred],
    };
    const band = {
      color: colorForField(metric),
      lower: [...histValues.map((_, i) => (i === lastActualIdx ? lastActual : null)), ...fLower],
      upper: [...histValues.map((_, i) => (i === lastActualIdx ? lastActual : null)), ...fUpper],
    };

    const agg = additive ? sum : avg;
    const forecastAgg = agg(fPred);
    const bestAgg = agg(fUpper);
    const worstAgg = agg(fLower);
    const priorActual = agg(histValues.slice(-horizon).filter((v): v is number => v != null));
    const expectedChange = priorActual !== 0 ? (forecastAgg - priorActual) / priorActual : null;
    const bt = result.backtestMetrics;

    return (
      <div className="grid gap-4">
        <TimeSeriesChart
          labels={labels}
          series={[historicalSeries, forecastSeries]}
          band={band}
          forecastStartIndex={histValues.length}
          height={230}
          formatValue={axisFormatter(metric)}
        />

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">model: {result.modelName}</Badge>
          <Badge variant={confVariant(result.confidence)}>confidence: {result.confidence}</Badge>
          {bt.wape != null && <Badge variant="ghost">backtest WAPE {formatPct(bt.wape)}</Badge>}
          {bt.mae != null && <Badge variant="ghost">MAE {formatMetric(metric, bt.mae)}</Badge>}
          <Badge variant="ghost">interval {Math.round(result.intervalLevel * 100)}%</Badge>
          <Button variant="outline" size="xs" className="ml-auto" onClick={onExport}>
            <Download /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label={additive ? `${horizon}-day total` : `${horizon}-day avg`} value={formatMetric(metric, forecastAgg)} />
          <SummaryCard label="vs prior period" value={formatPct(expectedChange)} />
          <SummaryCard label="Best case" value={formatMetric(metric, bestAgg)} />
          <SummaryCard label="Worst case" value={formatMetric(metric, worstAgg)} />
        </div>

        {result.warnings.length > 0 && (
          <ul className="grid gap-0.5 text-[11px] text-muted-foreground">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Competing models &amp; backtest</summary>
          <div className="mt-2 overflow-x-auto rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="px-2 py-1 font-medium">Model</th>
                  <th className="px-2 py-1 text-right font-medium">WAPE</th>
                  <th className="px-2 py-1 text-right font-medium">RMSE</th>
                  <th className="px-2 py-1 text-right font-medium">Windows</th>
                  <th className="px-2 py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.name} className={`border-b last:border-0 ${m.name === result.modelName ? "font-medium" : ""}`}>
                    <td className="px-2 py-1">{m.name}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{m.metrics?.wape != null ? formatPct(m.metrics.wape) : "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{m.metrics?.rmse != null ? m.metrics.rmse.toFixed(1) : "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{m.windows}</td>
                    <td className="px-2 py-1 text-muted-foreground">{m.eligible ? "eligible" : m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    );
  }
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
