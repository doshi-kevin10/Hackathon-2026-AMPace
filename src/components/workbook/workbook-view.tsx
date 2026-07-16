"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiRequestError, fetchWorkbook } from "@/lib/client-api";
import type { ParsedWorkbook } from "@/lib/schemas/workbook";
import { RawSheetView } from "./raw-sheet-view";
import { SheetSidebar } from "./sheet-sidebar";
import { SummaryBar } from "./summary-bar";
import { TableCard } from "./table-card";

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Skeleton className="mb-8 h-16 w-full" />
      <div className="flex gap-8">
        <div className="hidden w-60 space-y-2 lg:block">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="flex-1 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

export function WorkbookView({ workbookId }: { workbookId: string }) {
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchWorkbook(workbookId)
      .then((wb) => {
        if (cancelled) return;
        setWorkbook(wb);
        // Land on the first sheet that actually has tables.
        setSelectedSheet(wb.sheets.find((s) => s.tables.length > 0)?.index ?? 0);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiRequestError ? e.message : "Failed to load the workbook.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workbookId]);

  const onUpdated = useCallback((wb: ParsedWorkbook) => setWorkbook(wb), []);

  if (error) {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-4xl" aria-hidden>
          🤷
        </p>
        <h1 className="text-xl font-semibold">Workbook unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button nativeButton={false} render={<Link href="/" />}>
          Upload a workbook
        </Button>
      </main>
    );
  }
  if (!workbook) return <LoadingState />;

  const sheet = workbook.sheets.find((s) => s.index === selectedSheet) ?? workbook.sheets[0];

  return (
    <main className="flex-1">
      <SummaryBar workbook={workbook} />

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
        <SheetSidebar sheets={workbook.sheets} selected={sheet?.index ?? 0} onSelect={setSelectedSheet} />

        <div className="min-w-0 flex-1">
          {!sheet ? (
            <p className="text-muted-foreground">This workbook has no sheets.</p>
          ) : (
            <Tabs defaultValue="tables" key={sheet.index}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">{sheet.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {sheet.rowCount.toLocaleString()} × {sheet.columnCount.toLocaleString()} used range
                  {sheet.hiddenRows.length > 0 && ` · ${sheet.hiddenRows.length} hidden rows`}
                  {sheet.hiddenColumns.length > 0 && ` · ${sheet.hiddenColumns.length} hidden columns`}
                </span>
                <TabsList className="ml-auto">
                  <TabsTrigger value="tables">Detected tables</TabsTrigger>
                  <TabsTrigger value="raw">Raw sheet</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="tables" className="space-y-6">
                {sheet.tables.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                    <p className="mb-1 text-2xl" aria-hidden>
                      🫙
                    </p>
                    No tables were detected on this sheet.
                  </div>
                ) : (
                  sheet.tables.map((table) => (
                    <TableCard
                      key={table.id}
                      workbookId={workbook.id}
                      sheet={sheet}
                      table={table}
                      onUpdated={onUpdated}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="raw">
                <RawSheetView workbookId={workbook.id} sheet={sheet} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </main>
  );
}
