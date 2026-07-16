"use client";

import { useEffect, useState } from "react";
import type { MonitorResponse } from "@/lib/schemas/monitor";
import { cn } from "@/lib/utils";

const POLL_MS = 45_000;
const MAX_ANOMALIES = 5;

function useMonitor(datasetName: string) {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      fetch(`/api/datasets/${datasetName}/monitor`)
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body?.error?.message ?? "Monitor request failed");
          if (!cancelled) {
            setData(body);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to check for updates");
        });
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [datasetName]);

  return { data, error };
}

/** Live news + anomaly monitoring for one dataset's company — company comes from the dataset itself. */
export function CompanyMonitor({ datasetName, company }: { datasetName: string; company: string }) {
  const { data, error } = useMonitor(datasetName);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <p className="text-sm font-medium">Live monitoring: {company}</p>
        {data && !data.aiConfigured && (
          <span className="text-xs text-muted-foreground">
            (add ANTHROPIC_API_KEY to flag relevance)
          </span>
        )}
        {data && !data.slackConfigured && (
          <span className="text-xs text-muted-foreground">(add SLACK_WEBHOOK_URL for alerts)</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {data && data.anomalies.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Unusual moves
            {data.anomalies.length > MAX_ANOMALIES && ` (top ${MAX_ANOMALIES} of ${data.anomalies.length})`}
          </p>
          {data.anomalies.slice(0, MAX_ANOMALIES).map((a) => (
            <div key={a.id} className="rounded-md border border-border p-2.5 text-xs">
              <p className="font-medium">
                {a.direction === "jump" ? "📈" : "📉"} {a.columnName}{" "}
                {a.changePct >= 0 ? "+" : ""}
                {Math.round(a.changePct * 100)}% on {a.date}
              </p>
              <p className="mt-1 text-muted-foreground">{a.explanation ?? "No related news found yet."}</p>
              {a.sourceHeadline && (
                <a
                  href={a.sourceHeadline.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-foreground underline"
                >
                  {a.sourceHeadline.title}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="grid gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Recent news</p>
          {data.news.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent headlines found.</p>
          ) : (
            data.news.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                title={n.reason ?? undefined}
                className={cn(
                  "text-xs underline underline-offset-2",
                  n.relevant ? "text-red-600 dark:text-red-400" : "text-foreground"
                )}
              >
                {n.title}
                {n.source && <span className="text-muted-foreground"> — {n.source}</span>}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
