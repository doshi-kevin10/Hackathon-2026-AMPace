"use client";

import { useEffect, useMemo, useState } from "react";
import { Heatmap } from "@/components/charts/heatmap";
import { compactNumber } from "@/components/charts/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalyticsTable } from "@/lib/analytics/chart-data";
import { computeDailyGoalStatus, metricForTable } from "@/lib/analytics/goal-status";
import type { Goal, GoalMetric } from "@/lib/schemas/goal";

const formatterFor = (metric: GoalMetric) => (metric === "CPA" ? compactNumber : (n: number) => `${n.toFixed(2)}×`);

export function GoalTracker({ datasetName, table }: { datasetName: string; table: AnalyticsTable }) {
  // A company tracks ROAS or CPA — never both, and never a user's free choice.
  // The data layer already decides this (a "CPA" column only exists for
  // companies relabeled at the read layer), so the tracker just follows it.
  const metric = metricForTable(table);
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined); // undefined = loading
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/datasets/${datasetName}/goal`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setGoal(body.goal ?? null);
        if (body.goal) setTarget(String(body.goal.target));
      })
      .catch(() => !cancelled && setGoal(null));
    return () => {
      cancelled = true;
    };
  }, [datasetName]);

  const save = async () => {
    const parsed = Number(target);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive target value.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${datasetName}/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, target: parsed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not save the goal.");
      setGoal(body.goal);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the goal.");
    } finally {
      setBusy(false);
    }
  };

  const dailyStatus = useMemo(() => (goal ? computeDailyGoalStatus(table, goal) : []), [table, goal]);
  const greenRate = useMemo(() => {
    const withData = dailyStatus.filter((d) => d.band != null);
    if (withData.length === 0) return null;
    return withData.filter((d) => d.band === "green").length / withData.length;
  }, [dailyStatus]);

  if (goal === undefined) return null;

  if (!goal || editing) {
    return (
      <section>
        <h4 className="mb-1 text-sm font-semibold">Performance goal</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Set a target to turn this into a day-by-day heatmap: green near target, yellow off target, red well off
          target.
        </p>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">This company tracks</span>
            <span className="flex h-8 items-center rounded-md border border-border bg-muted px-2.5 text-sm font-medium">
              {metric}
            </span>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Target {metric === "ROAS" ? "(e.g. 2.5)" : "($, e.g. 15)"}</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={metric === "ROAS" ? "2.5" : "15"}
              className="h-8 w-32"
              inputMode="decimal"
            />
          </div>
          <Button size="sm" onClick={() => void save()} disabled={busy || !target.trim()}>
            {busy ? "Saving…" : "Save goal"}
          </Button>
          {goal && editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-semibold">Performance goal</h4>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
          {goal.metric} target: {formatterFor(goal.metric)(goal.target)}
        </span>
        {greenRate != null && (
          <span className="text-xs text-muted-foreground">{Math.round(greenRate * 100)}% of days on target</span>
        )}
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEditing(true)}>
          Edit goal
        </Button>
      </div>
      <Heatmap data={dailyStatus} formatValue={formatterFor(goal.metric)} />
    </section>
  );
}
