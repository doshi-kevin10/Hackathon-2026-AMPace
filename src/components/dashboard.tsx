"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DailyBriefing } from "@/components/home/daily-briefing";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { CountUp } from "@/components/reactbits/count-up";
import { SpotlightCard } from "@/components/reactbits/spotlight-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dataset } from "@/lib/databricks/analytics";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; datasets: Dataset[] };

export function Dashboard({ userName }: { userName: string }) {
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
    <main className="mx-auto max-w-7xl px-8 py-8">
      <DailyBriefing userName={userName} />

      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Live advertising performance, straight from Databricks.
          </p>
        </div>
        {state.kind === "ready" && state.datasets.length > 0 && (
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            {state.datasets.length} accounts
          </span>
        )}
      </div>

      {state.kind === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.datasets.map((d, i) => (
            <AnimatedContent key={d.name} delay={i * 60} className="group">
              <SpotlightCard className="flex h-full flex-col rounded-2xl border-border p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-base font-bold text-primary ring-1 ring-inset ring-primary/15">
                    {d.label.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold leading-tight tracking-tight">{d.label}</p>
                    <p className="text-[13px] text-muted-foreground">Advertising performance</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                    Live
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums">
                      {d.usesCpa
                        ? d.avgCpa != null
                          ? <CountUp to={d.avgCpa} decimals={2} prefix="$" />
                          : "—"
                        : d.avgRoas != null
                          ? <CountUp to={d.avgRoas} decimals={1} suffix="×" />
                          : "—"}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {d.usesCpa ? "Avg CPA" : "Avg ROAS"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums">
                      {d.totalAdspend != null ? <CountUp to={d.totalAdspend / 1000} decimals={0} prefix="$" suffix="K" /> : "—"}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total spend</p>
                  </div>
                  <div>
                    <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums">
                      <CountUp to={d.rowCount} decimals={0} />
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Days</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-3.5 text-[13px]">
                  <span className="text-muted-foreground">
                    {d.latestDate ? `Latest ${d.latestDate}` : "No data yet"}
                  </span>
                  <div className="flex items-center gap-4">
                    <Link href={`/datasets/${d.name}`} className="font-semibold text-primary hover:underline">
                      Open →
                    </Link>
                    <Link href={`/datasets/${d.name}/analytics`} className="text-muted-foreground hover:text-foreground">
                      Analytics →
                    </Link>
                  </div>
                </div>
              </SpotlightCard>
            </AnimatedContent>
          ))}
        </div>
      )}
    </main>
  );
}
