"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { RecentWorkbook } from "@/lib/format";

const subscribe = () => () => {};
const getSnapshot = () => sessionStorage.getItem("excel-studio-recent") ?? "[]";
const getServerSnapshot = () => "[]";

/** Workbooks uploaded during this browser session. */
export function RecentWorkbooks() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const recent = useMemo<RecentWorkbook[]>(() => {
    try {
      return JSON.parse(raw) as RecentWorkbook[];
    } catch {
      return [];
    }
  }, [raw]);

  if (recent.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-muted-foreground">Recent uploads this session</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {recent.map((wb) => (
          <Link key={wb.id} href={`/workbooks/${wb.id}`} className="group">
            <Card className="transition-colors group-hover:border-primary/50">
              <CardContent className="flex items-center gap-3 px-4">
                <span className="text-xl" aria-hidden>
                  📊
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{wb.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {wb.sheetCount} sheet{wb.sheetCount === 1 ? "" : "s"} · {wb.tableCount} table
                    {wb.tableCount === 1 ? "" : "s"} ·{" "}
                    {new Date(wb.uploadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
