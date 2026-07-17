"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { logActivity } from "@/lib/activity/log";
import {
  blankRow,
  deriveTable,
  editedCell,
  withAddedRow,
  withCalcSpec,
  withCellEdit,
  withDeletedRow,
  withNote,
  withoutCalcSpec,
} from "@/lib/datatab/derive";
import { buildSnapshot, filterByMonth, findDateColumn, monthSheets, sheetColor, sheetTint } from "@/lib/datatab/sheets";
import { useCustomTables } from "@/lib/datatab/use-custom-tables";
import { useLocalEdits } from "@/lib/datatab/use-local-edits";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

interface LiveData {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
  label: string;
}

/** A colored tab in the sheet strip. */
function SheetTab({
  active,
  color,
  onClick,
  onDoubleClick,
  title,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  onDoubleClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={title}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        active ? "border-transparent" : "border-border text-muted-foreground hover:text-foreground"
      )}
      style={
        active
          ? color
            ? { backgroundColor: sheetTint(color, 18), borderColor: color, color }
            : { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
          : undefined
      }
    >
      {color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </button>
  );
}

/** The Data tab: a live grid split into per-month sheets plus user-owned custom tables. */
export function DataWorkspace({ name, label }: { name: string; label: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("all"); // "all" | `month:<key>` | `custom:<id>`
  const ctrl = useRef<AbortController | null>(null);

  const local = useLocalEdits(name, label);
  const custom = useCustomTables(name, label);

  useEffect(() => {
    const c = new AbortController();
    ctrl.current = c;
    fetch(`/api/datasets/${name}`, { signal: c.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? "Failed to load");
        if (!c.signal.aborted) setData(b as LiveData);
      })
      .catch((e) => e?.name !== "AbortError" && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => c.abort();
  }, [name]);

  // Full live table with all local edits applied, then the per-month split.
  const liveDerived = useMemo(
    () => (data ? deriveTable({ columns: data.columns, rows: data.rows }, local.state) : null),
    [data, local.state]
  );
  const months = useMemo(() => (data ? monthSheets(data.columns, data.rows) : []), [data]);
  const dateCol = useMemo(() => (data ? findDateColumn(data.columns) : undefined), [data]);

  if (error)
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  if (!data || !liveDerived)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="flex-1 w-full" />
      </div>
    );

  // Resolve the active sheet → the grid + its edit handlers + accent color.
  const monthKey = active.startsWith("month:") ? active.slice(6) : null;
  const customId = active.startsWith("custom:") ? active.slice(7) : null;
  const customTable = customId ? custom.tables.find((t) => t.id === customId) : undefined;

  // Fall back to All if the active sheet vanished (data changed / table deleted).
  const monthSheet = monthKey ? months.find((m) => m.key === monthKey) : undefined;
  const resolved = customId ? (customTable ? active : "all") : monthKey ? (monthSheet ? active : "all") : "all";

  let grid = liveDerived;
  let accent: string | undefined;
  let notes = local.state.notes;
  let handlers: Partial<React.ComponentProps<typeof DataTable>> = {
    onEditCell: (rowIndex, column, text) => local.editCell(rowIndex, column, text),
    onAddColumn: local.addColumn,
    onDeleteColumn: local.deleteColumn,
    onAddRow: () => local.addRow(data.columns, data.rows.length + local.state.addedRows.length),
    onDeleteRow: local.deleteRow,
    onSetNote: (rowIndex, column, text) => local.setNote(rowIndex, column, text),
  };

  if (resolved.startsWith("month:") && monthSheet && dateCol) {
    grid = filterByMonth(liveDerived, dateCol.id, monthSheet.key);
    accent = monthSheet.color;
    // Month sheets share the live edit layer; handlers stay the same (keys map to originals).
  } else if (resolved.startsWith("custom:") && customTable) {
    const base = { columns: customTable.columns, rows: customTable.rows };
    grid = deriveTable(base, customTable.local);
    accent = sheetColor(customTable.colorIndex);
    notes = customTable.local.notes;
    const id = customTable.id;
    const cols = customTable.columns;
    handlers = {
      onEditCell: (rowIndex, column, text) =>
        custom.update(id, (l) => withCellEdit(l, rowIndex, column.id, editedCell(text, column.typeOverride ?? column.inferredType))),
      onAddColumn: (spec) => custom.update(id, (l) => withCalcSpec(l, { id: crypto.randomUUID(), ...spec })),
      onDeleteColumn: (columnId) => custom.update(id, (l) => withoutCalcSpec(l, columnId)),
      onAddRow: () => custom.update(id, (l) => withAddedRow(l, blankRow(cols))),
      onDeleteRow: (rowIndex) => custom.update(id, (l) => withDeletedRow(l, rowIndex)),
      onSetNote: (rowIndex, column, text) => custom.update(id, (l) => withNote(l, rowIndex, column.id, text)),
    };
  }

  const newTable = () => {
    const suggestion = monthSheet ? `${label} — ${monthSheet.label}` : customTable ? `${customTable.name} copy` : `${label} table`;
    const tableName = window.prompt("Name this table", suggestion);
    if (tableName == null) return;
    const id = custom.create(tableName, buildSnapshot(grid));
    setActive(`custom:${id}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Sheets">
        <SheetTab active={resolved === "all"} onClick={() => setActive("all")}>
          All
        </SheetTab>
        {months.map((m) => (
          <SheetTab key={m.key} active={resolved === `month:${m.key}`} color={m.color} onClick={() => setActive(`month:${m.key}`)}>
            {m.label}
          </SheetTab>
        ))}

        {custom.tables.length > 0 && <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />}

        {custom.tables.map((t) => {
          const color = sheetColor(t.colorIndex);
          const isActive = resolved === `custom:${t.id}`;
          const doRename = () => {
            const n = window.prompt("Rename table", t.name);
            if (n != null) custom.rename(t.id, n);
          };
          const doDelete = () => {
            if (window.confirm(`Delete table “${t.name}”? This can't be undone.`)) {
              if (resolved === `custom:${t.id}`) setActive("all");
              custom.remove(t.id);
            }
          };
          return (
            <div key={t.id} className="flex shrink-0 items-center rounded-md">
              <SheetTab
                active={isActive}
                color={color}
                onClick={() => setActive(`custom:${t.id}`)}
                onDoubleClick={doRename}
                title={`${t.name} — double-click to rename`}
              >
                {t.name}
              </SheetTab>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-1.5 text-muted-foreground hover:text-foreground"
                    />
                  }
                  aria-label={`Edit or delete ${t.name}`}
                  title={`Edit or delete ${t.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-1.5 pt-1 text-xs font-medium text-muted-foreground">Color</div>
                  <div className="flex gap-1 px-1.5 py-1">
                    {Array.from({ length: 8 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Color ${i + 1}`}
                        onClick={() => custom.recolor(t.id, i)}
                        className={cn(
                          "size-4 rounded-full ring-1 ring-foreground/10",
                          t.colorIndex === i && "ring-2 ring-foreground/60"
                        )}
                        style={{ backgroundColor: sheetColor(i) }}
                      />
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={doRename}>
                    <Pencil className="size-3.5" /> Rename…
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={doDelete}>
                    <Trash2 className="size-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        <Button variant="outline" size="sm" className="ml-1 h-8 shrink-0" onClick={newTable}>
          <Plus className="size-3.5" /> New table
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DataTable
          key={resolved}
          columns={grid.columns}
          rows={grid.rows}
          keys={grid.keys}
          totalRowCount={grid.rows.length}
          label={label}
          accentColor={accent}
          notes={notes}
          {...handlers}
          onDownload={() =>
            logActivity({ dataset: name, label, href: `/datasets/${name}`, kind: "download", message: `Downloaded ${label}.xlsx` })
          }
        />
      </div>
    </div>
  );
}
