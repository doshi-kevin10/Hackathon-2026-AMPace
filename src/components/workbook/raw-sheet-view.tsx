"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParsedSheet, SheetGrid } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

/** Four distinguishable table tints, assigned in fixed order per sheet. */
const TABLE_TINTS = [
  { bg: "bg-sky-50 dark:bg-sky-950/40", edge: "border-sky-400", chip: "bg-sky-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", edge: "border-emerald-400", chip: "bg-emerald-400" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", edge: "border-amber-400", chip: "bg-amber-400" },
  { bg: "bg-violet-50 dark:bg-violet-950/40", edge: "border-violet-400", chip: "bg-violet-400" },
];

const colLetter = (c: number): string => {
  let s = "";
  for (let n = c; n >= 0; n = Math.floor(n / 26) - 1) {
    s = String.fromCharCode(65 + (n % 26)) + s;
  }
  return s;
};

interface RawSheetViewProps {
  workbookId: string;
  sheet: ParsedSheet;
}

interface GridState {
  key: string;
  grid: SheetGrid | null;
  error: string | null;
}

export function RawSheetView({ workbookId, sheet }: RawSheetViewProps) {
  // The state is tagged with the request key; a stale tag means "loading".
  // This avoids resetting state synchronously inside the effect.
  const layoutKey = sheet.tables.map((t) => `${t.id}:${t.range}:${t.excluded}`).join("|");
  const key = `${workbookId}/${sheet.index}/${layoutKey}`;
  const [state, setState] = useState<GridState>({ key: "", grid: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workbooks/${workbookId}/sheets/${sheet.index}/grid`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? "Failed to load the sheet grid");
        if (!cancelled) setState({ key, grid: body as SheetGrid, error: null });
      })
      .catch(
        (e) =>
          !cancelled &&
          setState({ key, grid: null, error: e instanceof Error ? e.message : "Failed to load grid" })
      );
    return () => {
      cancelled = true;
    };
  }, [workbookId, sheet.index, key]);

  const grid = state.key === key ? state.grid : null;
  const error = state.key === key ? state.error : null;

  const cellInfo = (r: number, c: number) => {
    if (!grid) return null;
    for (let i = 0; i < grid.tables.length; i++) {
      const t = grid.tables[i];
      const s = t.source;
      if (r >= s.startRow && r <= s.endRow && c >= s.startColumn && c <= s.endColumn) {
        return {
          tint: TABLE_TINTS[i % TABLE_TINTS.length],
          isHeader: t.headerRows.includes(r),
          excluded: t.excluded,
          edges: {
            top: r === s.startRow,
            bottom: r === s.endRow,
            left: c === s.startColumn,
            right: c === s.endColumn,
          },
        };
      }
    }
    return null;
  };

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!grid) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (grid.cells.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">This sheet is empty.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {grid.tables.map((t, i) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            <span
              className={cn("h-2.5 w-2.5 rounded-sm", TABLE_TINTS[i % TABLE_TINTS.length].chip)}
              aria-hidden
            />
            {t.name}
            {t.excluded && " (excluded)"}
          </span>
        ))}
        {grid.truncated && (
          <span className="ml-auto">
            Showing {grid.cells.length.toLocaleString()} of {grid.totalRows.toLocaleString()} rows
          </span>
        )}
      </div>

      <div className="max-h-[560px] overflow-auto rounded-md border">
        <table className="border-collapse text-xs" role="grid" aria-label={`Raw grid of ${grid.sheetName}`}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 min-w-10 border bg-muted px-1 text-muted-foreground" />
              {grid.cells[0].map((_, c) => (
                <th
                  key={c}
                  className="min-w-20 border bg-muted px-2 py-1 text-center font-medium text-muted-foreground"
                >
                  {colLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.cells.map((row, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-10 border bg-muted px-1 text-center font-medium text-muted-foreground">
                  {r + 1}
                </th>
                {row.map((val, c) => {
                  const info = cellInfo(r, c);
                  return (
                    <td
                      key={c}
                      className={cn(
                        "max-w-48 truncate border border-border/60 px-2 py-1",
                        info && !info.excluded && info.tint.bg,
                        info && !info.excluded && info.isHeader && "font-semibold",
                        info && !info.excluded && [
                          info.edges.top && `border-t-2 ${info.tint.edge}`,
                          info.edges.bottom && `border-b-2 ${info.tint.edge}`,
                          info.edges.left && `border-l-2 ${info.tint.edge}`,
                          info.edges.right && `border-r-2 ${info.tint.edge}`,
                        ],
                        info?.excluded && "bg-muted/50 text-muted-foreground line-through decoration-muted-foreground/40"
                      )}
                      title={val ?? undefined}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
