"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApiRequestError, syncWorkbook } from "@/lib/client-api";
import { compact, workbookStats } from "@/lib/format";
import type { ParsedWorkbook } from "@/lib/schemas/workbook";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

interface SummaryBarProps {
  workbook: ParsedWorkbook;
  onUpdated: (wb: ParsedWorkbook) => void;
}

export function SummaryBar({ workbook, onUpdated }: SummaryBarProps) {
  const stats = workbookStats(workbook);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const syncedCount = workbook.sheets
    .flatMap((s) => s.tables)
    .filter((t) => t.databricks).length;

  const sync = async () => {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await syncWorkbook(workbook.id);
      onUpdated(res.workbook);
      const ok = res.results.filter((r) => r.status === "synced").length;
      const failed = res.results.filter((r) => r.status === "failed");
      setSyncNote(
        failed.length
          ? `${ok} synced, ${failed.length} failed (${failed[0].reason?.slice(0, 80)})`
          : `${ok} table${ok === 1 ? "" : "s"} synced to kevin_dev`
      );
    } catch (e) {
      setSyncNote(e instanceof ApiRequestError ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-lg font-semibold" title={workbook.filename}>
            {workbook.filename}
          </h1>
          <p className="text-xs text-muted-foreground">
            Uploaded {new Date(workbook.uploadedAt).toLocaleString()} · parsed in{" "}
            {workbook.parseTimeMs.toLocaleString()} ms
            {syncedCount > 0 && ` · ${syncedCount} table${syncedCount === 1 ? "" : "s"} live on Databricks`}
          </p>
          {syncNote && <p className="text-xs text-muted-foreground">{syncNote}</p>}
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Sheets" value={compact(stats.sheets)} />
          <Stat label="Tables" value={compact(stats.tables)} />
          <Stat label="Rows" value={compact(stats.rows)} />
          <Stat label="Columns" value={compact(stats.columns)} />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => void sync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync to Databricks"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/workbooks/${workbook.id}/export/json`} download />}
          >
            Export JSON
          </Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
            Upload another
          </Button>
        </div>
      </div>
    </div>
  );
}
