"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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

export function SummaryBar({ workbook }: { workbook: ParsedWorkbook }) {
  const stats = workbookStats(workbook);
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
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Sheets" value={compact(stats.sheets)} />
          <Stat label="Tables" value={compact(stats.tables)} />
          <Stat label="Rows" value={compact(stats.rows)} />
          <Stat label="Columns" value={compact(stats.columns)} />
        </div>

        <div className="flex gap-2">
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
