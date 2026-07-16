"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dataset } from "@/lib/databricks/analytics";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; datasets: Dataset[] };

/** Group datasets by company, preserving alphabetical company + dataset order. */
function groupByCompany(datasets: Dataset[]): { company: string; items: Dataset[] }[] {
  const map = new Map<string, Dataset[]>();
  for (const d of datasets) {
    const list = map.get(d.company) ?? [];
    list.push(d);
    map.set(d.company, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([company, items]) => ({ company, items }));
}

export function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const groups = useMemo(
    () => (state.kind === "ready" ? groupByCompany(state.datasets) : []),
    [state]
  );

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
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">Live advertising performance, straight from Databricks.</p>
      </div>

      {state.kind === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && state.datasets.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <p className="mb-1 text-2xl" aria-hidden>📊</p>
          No datasets are available in the workspace yet.
        </div>
      )}

      {state.kind === "ready" && state.datasets.length > 0 && (
        <div className="space-y-8">
          {groups.map(({ company, items }) => (
            <section key={company}>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {company.slice(0, 2).toUpperCase()}
                </span>
                <h2 className="text-lg font-semibold">{company}</h2>
                <span className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? "dataset" : "datasets"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <Link key={d.name} href={`/datasets/${d.name}`} className="group">
                    <Card className="h-full transition-colors group-hover:border-primary/50">
                      <CardContent className="flex h-full flex-col gap-2 p-5">
                        <span className="font-medium">{d.shortLabel}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground" title={d.fqn}>
                          {d.fqn}
                        </span>
                        <span className="mt-auto text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          Open analytics →
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
