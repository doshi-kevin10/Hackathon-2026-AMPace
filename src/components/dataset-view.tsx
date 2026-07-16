"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalcColumns } from "@/components/analytics/calc-columns";
import { Chatbot } from "@/components/analytics/chatbot";
import { CompanyMonitor } from "@/components/analytics/company-monitor";
import { GoalTracker } from "@/components/analytics/goal-tracker";
import { NewsSidebar } from "@/components/analytics/news-sidebar";
import { hasChartableData, TableAnalytics } from "@/components/analytics/table-analytics";
import { useMonitor } from "@/components/analytics/use-monitor";
import { KpiSummary } from "@/components/kpi-summary";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyCalcColumns, type CalcColumnSpec } from "@/lib/formula/calc-columns";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const POLL_MS = 30_000;

interface LiveData {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
  databricksTable: string;
  fetchedAt: string;
  /** One dataset = one company now, so this doubles as the company name. */
  label: string;
}

// Calc columns are session-scoped per dataset (not written to Databricks).
const calcKey = (name: string) => `ampulse-calc-${name}`;
const readCalc = (name: string): CalcColumnSpec[] => {
  if (typeof window === "undefined") return []; // SSR-safe
  try {
    return JSON.parse(sessionStorage.getItem(calcKey(name)) ?? "[]") as CalcColumnSpec[];
  } catch {
    return [];
  }
};

export function DatasetView({ name }: { name: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: monitorData, error: monitorError } = useMonitor(name);
  const [calcSpecs, setCalcSpecs] = useState<CalcColumnSpec[]>([]);
  // Load calc columns for the current dataset without an effect: re-read from
  // sessionStorage during render when the dataset changes (first client render
  // is [] to match SSR, then this syncs in the stored specs — no hydration gap).
  const [syncedName, setSyncedName] = useState<string | null>(null);
  if (syncedName !== name) {
    setSyncedName(name);
    setCalcSpecs(readCalc(name));
  }

  const persistCalc = (next: CalcColumnSpec[]) => {
    setCalcSpecs(next);
    try {
      sessionStorage.setItem(calcKey(name), JSON.stringify(next));
    } catch {
      // sessionStorage unavailable — keep in memory for the session
    }
  };

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    const load = () => {
      controller?.abort();
      controller = new AbortController();
      setRefreshing(true);
      fetch(`/api/datasets/${name}`, { signal: controller.signal })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body?.error?.message ?? "Failed to load");
          if (!cancelled) {
            setData(body as LiveData);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled && e?.name !== "AbortError") setError(e instanceof Error ? e.message : "Failed to load");
        })
        .finally(() => !cancelled && setRefreshing(false));
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(timer);
    };
  }, [name]);

  // Base rows + user calc columns. Recomputes on data refresh and on calc edits.
  const augmented = useMemo(
    () => (data ? applyCalcColumns({ columns: data.columns, rows: data.rows }, calcSpecs) : { columns: [], rows: [] }),
    [data, calcSpecs]
  );

  const dateColId = useMemo(
    () => augmented.columns.find((c) => c.name === "Date")?.id ?? null,
    [augmented.columns]
  );

  // Client-side date-range filter (instant). Feeds the grid, KPIs, goal tracker, and charts.
  const filteredRows = useMemo(() => {
    if (!dateColId || (!from && !to)) return augmented.rows;
    return augmented.rows.filter((row) => {
      const iso = row[dateColId]?.normalized;
      if (typeof iso !== "string") return false;
      const d = iso.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [augmented.rows, dateColId, from, to]);

  const latestDate = useMemo(() => {
    if (!dateColId) return null;
    let max: string | null = null;
    for (const row of augmented.rows) {
      const iso = row[dateColId]?.normalized;
      if (typeof iso === "string" && (!max || iso > max)) max = iso.slice(0, 10);
    }
    return max;
  }, [augmented.rows, dateColId]);

  const hasDates = latestDate != null;

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← All companies
        </Link>
      </div>

      {error && !data ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : !data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div className="mr-auto">
                <h1 className="text-2xl font-semibold tracking-tight">{data.label}</h1>
                <p className="font-mono text-xs text-muted-foreground">{data.databricksTable}</p>
              </div>

              {hasDates && (
                <>
                  <div className="grid gap-1">
                    <Label htmlFor="from" className="text-xs">From date</Label>
                    <Input id="from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="to" className="text-xs">To date</Label>
                    <Input id="to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
                  </div>
                  {(from || to) && (
                    <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
                      Clear dates
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${refreshing ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} aria-hidden />
                {refreshing ? "Refreshing…" : "Live"} · auto-refreshes every 30s
              </span>
              <span>Last refreshed {new Date(data.fetchedAt).toLocaleTimeString()}</span>
              {latestDate && <span>Latest data: {latestDate}</span>}
              <span>
                {filteredRows.length.toLocaleString()}
                {filteredRows.length !== augmented.rows.length && ` of ${augmented.rows.length.toLocaleString()}`} rows
              </span>
            </div>

            <KpiSummary columns={augmented.columns} rows={filteredRows} />

            <CalcColumns
              columns={augmented.columns}
              sampleRow={filteredRows[0] ?? augmented.rows[0]}
              specs={calcSpecs}
              onAdd={(spec) => persistCalc([...calcSpecs, spec])}
              onRemove={(id) => persistCalc(calcSpecs.filter((s) => s.id !== id))}
            />

            <Tabs defaultValue="analytics">
              <TabsList className="mb-4">
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="grid gap-6">
                <GoalTracker datasetName={name} table={{ columns: augmented.columns, rows: filteredRows }} />
                {hasChartableData({ columns: augmented.columns, rows: filteredRows }) ? (
                  <TableAnalytics table={{ columns: augmented.columns, rows: filteredRows }} />
                ) : (
                  <p className="text-sm text-muted-foreground">No numeric data to chart yet.</p>
                )}
                <CompanyMonitor company={data.label} data={monitorData} error={monitorError} />
              </TabsContent>

              <TabsContent value="data">
                {/* Remount when the column SET changes (calc column added/removed) so
                    TanStack state can't keep referencing a removed calc column id.
                    The key is stable across the 30s refresh and date filtering. */}
                <DataTable
                  key={augmented.columns.map((c) => c.id).join(",")}
                  columns={augmented.columns}
                  rows={filteredRows}
                  totalRowCount={filteredRows.length}
                />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="grid w-full gap-6 lg:w-[340px] lg:shrink-0">
            <NewsSidebar news={monitorData?.news ?? []} />
            <Chatbot />
          </aside>
        </div>
      )}
    </main>
  );
}
