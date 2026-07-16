"use client";

import type { MonitorResponse } from "@/lib/schemas/monitor";

const MAX_ANOMALIES = 5;

/** Anomaly ("unusual moves") panel — news now lives in the sidebar (NewsSidebar). */
export function CompanyMonitor({
  company,
  data,
  error,
}: {
  company: string;
  data: MonitorResponse | null;
  error: string | null;
}) {
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
    </div>
  );
}
