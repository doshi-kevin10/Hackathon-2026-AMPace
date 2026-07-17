"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { WidgetCard, type CompanyStat } from "@/components/dashboard/widget-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Table } from "@/lib/dashboard/compute";
import { clearDashboard, getDashboard, removeWidget, subscribeDashboard, type WidgetSpec } from "@/lib/dashboard/widgets";

interface LiveData extends Table {
  label: string;
}

/**
 * The company's analytics dashboard. Starts empty — the top-right Analyst
 * chatbot fills it with widgets. All widget state is local (per company); the
 * underlying data is read-only from Databricks.
 */
export function DashboardCanvas({ name }: { name: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specs, setSpecs] = useState<WidgetSpec[]>([]);
  const [companies, setCompanies] = useState<CompanyStat[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const c = new AbortController();
    ctrl.current = c;
    fetch(`/api/datasets/${name}`, { signal: c.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? "Failed to load");
        if (!c.signal.aborted) setData(b as LiveData);
      })
      .catch((e) => e?.name !== "AbortError" && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => c.abort();
  }, [name]);

  // Dashboard specs (local, per company) — read + live-update.
  useEffect(() => {
    const refresh = () => setSpecs(getDashboard(name));
    refresh();
    return subscribeDashboard(refresh);
  }, [name]);

  // Company comparison widgets need the cross-company summary.
  const needsCompanies = specs.some((s) => s.type === "compare");
  useEffect(() => {
    if (!needsCompanies || companies.length) return;
    let active = true;
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((d) => active && setCompanies((d.datasets ?? d ?? []) as CompanyStat[]))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [needsCompanies, companies.length]);

  const table = useMemo<Table | null>(() => (data ? { columns: data.columns, rows: data.rows } : null), [data]);

  if (error)
    return <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>;
  if (!data || !table) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-48 w-full lg:col-span-2" /><Skeleton className="h-56 w-full" /><Skeleton className="h-56 w-full" /></div>;

  if (specs.length === 0) {
    return (
      <div className="grid min-h-[50vh] place-items-center rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Build your analytics with AMPace</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This dashboard starts blank. Open <span className="font-medium text-foreground">AMPace</span> (top-right) and ask for a chart, table, or alert — for example:
          </p>
          <div className="mt-4 grid gap-2 text-left text-sm">
            {["Show me revenue trends", "How does ROAS compare across companies?", "Break down revenue by day of week", "What needs my attention?"].map((s) => (
              <div key={s} className="rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground">“{s}”</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {specs.length} {specs.length === 1 ? "widget" : "widgets"} · built with AMPace · local to {data.label}
        </p>
        <button
          type="button"
          onClick={() => clearDashboard(name)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" /> Clear all
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {specs.map((spec) => (
          <WidgetCard key={spec.id} spec={spec} table={table} label={data.label} companies={companies} onRemove={() => removeWidget(name, spec.id)} />
        ))}
      </div>
    </div>
  );
}
