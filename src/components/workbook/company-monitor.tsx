"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiRequestError, patchTable } from "@/lib/client-api";
import type { MonitorResponse } from "@/lib/schemas/monitor";
import type { ParsedTable, ParsedWorkbook } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

const POLL_MS = 45_000;
const MAX_ANOMALIES = 5;

function useMonitor(workbookId: string, tableId: string, enabled: boolean) {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = () => {
      fetch(`/api/workbooks/${workbookId}/tables/${tableId}/monitor`)
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
  }, [workbookId, tableId, enabled]);

  return { data, error };
}

export function CompanyMonitor({
  workbookId,
  table,
  onUpdated,
}: {
  workbookId: string;
  table: ParsedTable;
  onUpdated: (wb: ParsedWorkbook) => void;
}) {
  const [companyInput, setCompanyInput] = useState(table.company ?? "");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { data, error } = useMonitor(workbookId, table.id, Boolean(table.company));

  const saveCompany = async () => {
    const name = companyInput.trim();
    if (!name) return;
    setBusy(true);
    setSaveError(null);
    try {
      onUpdated(await patchTable(workbookId, table.id, { company: name }));
    } catch (e) {
      setSaveError(e instanceof ApiRequestError ? e.message : "Could not save the company.");
    } finally {
      setBusy(false);
    }
  };

  if (!table.company) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="mb-2 text-sm font-medium">Track real-time news for this data</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Assign the company/advertiser this table tracks to pull live news, flag headlines that may
          affect these metrics, and get Slack alerts on unusual jumps or drops.
        </p>
        <div className="flex gap-2">
          <Input
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            placeholder="e.g. American Airlines"
            className="h-8 max-w-64"
          />
          <Button size="sm" onClick={() => void saveCompany()} disabled={busy || !companyInput.trim()}>
            {busy ? "Saving…" : "Track"}
          </Button>
        </div>
        {saveError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {saveError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <p className="text-sm font-medium">Live monitoring: {table.company}</p>
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
