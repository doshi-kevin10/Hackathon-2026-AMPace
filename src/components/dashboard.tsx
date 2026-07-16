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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.datasets.map((d) => (
            <Link key={d.name} href={`/datasets/${d.name}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 font-semibold text-primary">
                      {d.label.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium">{d.label}</span>
                  </div>
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
      )}
    </main>
  );
}
