"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsBundle } from "@/lib/analytics/engine";
import type { ComparisonMode } from "@/lib/analytics/comparison";
import type { Granularity } from "@/lib/analytics/series";
import { fetchAnalytics } from "@/lib/client-analytics";
import type { AnalyticsRequestBody, CanonicalMetricId } from "@/lib/analytics/request-schemas";
import { AiSummaryPanel } from "./ai-summary-panel";
import { AnomaliesPanel } from "./anomalies-panel";
import { ComparisonCards } from "./comparison-cards";
import { CorrelationPanel } from "./correlation-panel";
import { DataQualityPanel } from "./data-quality-panel";
import { DriversPanel } from "./drivers-panel";
import { ForecastPanel } from "./forecast-panel";
import { METRIC_OPTIONS, colorForField } from "./fmt";
import { SeriesCharts } from "./series-charts";
import { StatsPanel } from "./stats-panel";

const selectCls = "h-8 rounded-md border border-border bg-background px-2 text-sm";
const GRANULARITIES: Granularity[] = ["day", "week", "month"];
const COMPARISONS: { id: ComparisonMode; label: string }[] = [
  { id: "previous_period", label: "Previous period" },
  { id: "previous_week", label: "Previous week" },
  { id: "previous_month", label: "Previous month" },
  { id: "previous_quarter", label: "Previous quarter" },
  { id: "previous_year", label: "Previous year" },
];
const WINDOWS = [7, 14, 28, 30, 90];
const DEFAULT_METRICS: CanonicalMetricId[] = ["total_adspend", "revenue", "roas", "cvr"];

/** Analytics content for one company (embedded inside CompanyView). Clean by default; depth on demand. */
export function AnalyticsWorkspace({ name }: { name: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("previous_period");
  const [window, setWindow] = useState(28);
  const [metrics, setMetrics] = useState<Set<CanonicalMetricId>>(() => new Set(DEFAULT_METRICS));

  const [data, setData] = useState<AnalyticsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const initedRange = useRef(false);
  const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

  const selectedMetrics = useMemo(() => METRIC_OPTIONS.filter((m) => metrics.has(m.id)).map((m) => m.id), [metrics]);

  const analyticsReq = useMemo<AnalyticsRequestBody>(
    () => ({
      from: from || undefined,
      to: to || undefined,
      granularity,
      metrics: selectedMetrics.length ? selectedMetrics : undefined,
      comparisonMode,
      rollingWindows: [window],
    }),
    [from, to, granularity, selectedMetrics, comparisonMode, window]
  );

  const load = () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError(null);
    fetchAnalytics(name, analyticsReq, c.signal)
      .then((d) => {
        setData(d);
        // On first load, default to a trailing 30-day window so period comparison is meaningful.
        if (!initedRange.current && !from && !to && d.latestDate) {
          initedRange.current = true;
          setFrom(addDays(d.latestDate, -29));
          setTo(d.latestDate);
        }
      })
      .catch((e) => e?.name !== "AbortError" && setError(e instanceof Error ? e.message : "Failed to load analytics"))
      .finally(() => c.signal.aborted || setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-change with a loading flag (shared loader used by Refresh)
    load();
    return () => ctrl.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, analyticsReq]);

  const toggle = (id: CanonicalMetricId) =>
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border bg-card/50 p-3">
        <div className="grid gap-1">
          <Label htmlFor="from" className="text-xs">From</Label>
          <Input id="from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="to" className="text-xs">To</Label>
          <Input id="to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Granularity</Label>
          <select className={selectCls} value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)} aria-label="Granularity">
            {GRANULARITIES.map((g) => (
              <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Compare to</Label>
          <select className={selectCls} value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)} aria-label="Compare to">
            {COMPARISONS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Rolling window</Label>
          <select className={selectCls} value={window} onChange={(e) => setWindow(Number(e.target.value))} aria-label="Rolling window">
            {WINDOWS.map((w) => (
              <option key={w} value={w}>{w} days</option>
            ))}
          </select>
        </div>
        {(from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</Button>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          {METRIC_OPTIONS.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={metrics.has(m.id)} onChange={() => toggle(m.id)} style={{ accentColor: colorForField(m.id) }} />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      ) : !data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          {data.latestDate && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {data.observations} days · {data.range.from} → {data.range.to} · latest {data.latestDate}
            </p>
          )}
          <ComparisonCards comparison={data.comparison} />
          <AiSummaryPanel company={name} analytics={analyticsReq} />
          <SeriesCharts series={data.series} />
          <ForecastPanel company={name} latestDate={data.latestDate} />

          <details className="rounded-lg border bg-card/30 p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Deep dive — drivers, anomalies, baseline stats &amp; correlation</summary>
            <div className="mt-4 grid gap-6">
              <DriversPanel drivers={data.drivers} />
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <AnomaliesPanel anomalies={data.anomalies} />
                <DataQualityPanel quality={data.dataQuality} />
              </div>
              <StatsPanel baseline={data.baseline} trends={data.trends} />
              <CorrelationPanel company={name} from={from || undefined} to={to || undefined} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
