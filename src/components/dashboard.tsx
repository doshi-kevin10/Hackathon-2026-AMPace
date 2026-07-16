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
              <Card className="h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md group-focus-visible:border-primary">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-base font-semibold text-primary ring-1 ring-inset ring-primary/10">
                      {d.label.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold leading-tight">{d.label}</p>
                      <p className="text-xs text-muted-foreground">Advertising performance</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <p className="font-semibold tabular-nums">{d.rowCount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">days of data</p>
                    </div>
                    {d.latestDate && (
                      <div>
                        <p className="font-semibold tabular-nums">{d.latestDate}</p>
                        <p className="text-xs text-muted-foreground">latest</p>
                      </div>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                      Live
                    </span>
                  </div>

                  <span className="mt-auto text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open analytics →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
