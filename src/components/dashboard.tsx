"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dataset } from "@/lib/databricks/analytics";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; datasets: Dataset[] };

export function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/datasets")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? "Failed to load datasets");
        if (!cancelled) setState({ kind: "ready", datasets: body.datasets });
      })
      .catch((e) => !cancelled && setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to load" }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live advertising performance, straight from Databricks.
        </p>
      </div>

      {state.kind === "loading" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && state.datasets.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <p className="mb-1 text-2xl" aria-hidden>📊</p>
          No company datasets are available yet — contact an administrator.
        </div>
      )}

      {state.kind === "ready" && state.datasets.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.datasets.map((d) => (
            <Link key={d.name} href={`/datasets/${d.name}`} className="group focus-visible:outline-none">
              <Card className="h-full overflow-hidden border-primary/10 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5 group-focus-visible:border-primary">
                {/* Blue accent strip */}
                <div className="h-1.5 bg-gradient-to-r from-primary to-primary/40" aria-hidden />
                <CardContent className="flex h-full flex-col gap-5 p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-base font-semibold text-primary ring-1 ring-inset ring-primary/15">
                      {d.label.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold leading-tight">{d.label}</p>
                      <p className="text-xs text-muted-foreground">Advertising performance</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      Live
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {d.avgRoas != null ? `${d.avgRoas.toLocaleString("en", { maximumFractionDigits: 1 })}×` : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Avg ROAS</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {d.totalAdspend != null
                          ? `$${(d.totalAdspend / 1000).toLocaleString("en", { maximumFractionDigits: 0 })}K`
                          : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Total spend</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold tabular-nums">{d.rowCount.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">Days</p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {d.latestDate ? `Latest ${d.latestDate}` : "No data yet"}
                    </span>
                    <span className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open analytics →
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
