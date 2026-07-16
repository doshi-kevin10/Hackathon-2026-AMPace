"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/tables/data-table";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";

const POLL_MS = 30_000;

interface LiveData {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
  databricksTable: string;
  fetchedAt: string;
  label: string;
}

export function DatasetView({ name }: { name: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  const dateColId = useMemo(
    () => data?.columns.find((c) => c.name === "Date")?.id ?? null,
    [data]
  );

  // Client-side date-range filter (instant — no server round trip).
  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!dateColId || (!from && !to)) return data.rows;
    return data.rows.filter((row) => {
      const iso = row[dateColId]?.normalized;
      if (typeof iso !== "string") return false;
      const d = iso.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [data, dateColId, from, to]);

  const latestDate = useMemo(() => {
    if (!data || !dateColId) return null;
    let max: string | null = null;
    for (const row of data.rows) {
      const iso = row[dateColId]?.normalized;
      if (typeof iso === "string" && (!max || iso > max)) max = iso.slice(0, 10);
    }
    return max;
  }, [data, dateColId]);

  // Only offer the date-range filter when the dataset actually has dated rows
  // (some tables have no Date column populated — a date filter there is a no-op).
  const hasDates = latestDate != null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
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
        <>
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
              {filteredRows.length !== data.rows.length && ` of ${data.rows.length.toLocaleString()}`} rows
            </span>
          </div>

          <DataTable columns={data.columns} rows={filteredRows} totalRowCount={filteredRows.length} />
        </>
      )}
    </main>
  );
}
