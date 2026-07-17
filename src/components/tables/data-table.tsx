"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Download, Plus, Trash2, X } from "lucide-react";
import { AddColumnDialog } from "@/components/tables/add-column-dialog";
import { CellNote } from "@/components/tables/cell-note";
import { FormulaPanel } from "@/components/tables/formula-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { editKey } from "@/lib/datatab/derive";
import { CANONICAL_ORDER, isCanonicalTable } from "@/lib/excel/canonicalize";
import type { CalcFormat } from "@/lib/formula/calc-columns";
import { formatCell } from "@/lib/format";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

type Row = Record<string, CellValue>;

const NUMERIC = new Set(["integer", "decimal", "currency", "percentage"]);

/** Faint blue wash that groups the numeric metric columns (AMPlify-style), theme-aware. */
const NUM_TINT = "bg-sky-50/70 dark:bg-sky-950/25";

/** Columns that represent a delta get red/green values (like AMPlify's % Change / $ Change). */
const isChangeCol = (name: string) => /change|delta|diff|growth|Δ|\bvs\b|\bwow\b|\bmom\b|\byoy\b/i.test(name);

interface DataTableProps {
  columns: ParsedColumn[];
  rows: Row[];
  totalRowCount: number;
  previewTruncated?: boolean;
  /** Dataset label, used for the export filename. */
  label?: string;
  /** Stable original index for each row (from deriveTable), used as the edit/delete key. */
  keys?: number[];
  /** Local-edit hooks (all client-side, never touch Databricks). When omitted the grid is read-only. */
  onEditCell?: (rowIndex: number, column: ParsedColumn, text: string) => void;
  onAddColumn?: (spec: { name: string; formula: string; format: CalcFormat }) => void;
  onDeleteColumn?: (columnId: string) => void;
  onAddRow?: () => void;
  onDeleteRow?: (rowIndex: number, displayNumber: number) => void;
  onDownload?: () => void;
  /** Cell notes keyed like edits (`${rowIndex}:${colId}`); with onSetNote the grid shows note markers. */
  notes?: Record<string, string>;
  onSetNote?: (rowIndex: number, column: ParsedColumn, text: string) => void;
  /** Accent color (CSS) for this sheet — colors the top border and header. */
  accentColor?: string;
  /** Optional controlled state so the analysis session can capture the view (§7.4). */
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  globalFilter?: string;
  onGlobalFilterChange?: (s: string) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (s: ColumnFiltersState) => void;
}

/** Excel-like grid: scrollable, gridlines, row numbers, sticky header, sort, search, filters, inline edit + calc columns. */
export function DataTable(props: DataTableProps) {
  const { columns, rows, totalRowCount, previewTruncated, label, keys, onEditCell, onAddColumn, onDeleteColumn, onAddRow, onDeleteRow, onDownload, notes, onSetNote, accentColor } = props;
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<{ rowIndex: number; colId: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // The date column (if any) gets a from/to range filter instead of a text box.
  const dateCol = columns.find((c) => {
    const t = c.typeOverride ?? c.inferredType;
    return t === "date" || t === "datetime";
  });

  // Controlled when the parent supplies state (session capture), else internal.
  const sorting = props.sorting ?? internalSorting;
  const setSorting = props.onSortingChange ?? setInternalSorting;
  const globalFilter = props.globalFilter ?? internalGlobalFilter;
  const setGlobalFilter = props.onGlobalFilterChange ?? setInternalGlobalFilter;
  const columnFilters = props.columnFilters ?? internalColumnFilters;
  const setColumnFilters = props.onColumnFiltersChange ?? setInternalColumnFilters;

  // Ad-performance tables show the canonical metric columns by default; extra
  // source columns stay in the Columns menu. User calc columns (formula set)
  // are always shown — the user just created them.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!isCanonicalTable({ columns })) return {};
    const alwaysShow = new Set<string>([...CANONICAL_ORDER, "CPA"]);
    return Object.fromEntries(
      columns.filter((c) => !alwaysShow.has(c.name) && c.formula == null).map((c) => [c.id, false])
    );
  });

  const columnDefs = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        accessorFn: (row) => row[col.id]?.normalized ?? undefined,
        header: col.name,
        meta: col,
        sortUndefined: "last",
        filterFn:
          col.id === dateCol?.id
            ? // Date range: compare ISO strings (lexicographic == chronological).
              (row, columnId, value: { from?: string; to?: string }) => {
                const d = String(row.original[columnId]?.normalized ?? "");
                if (!d) return false;
                if (value.from && d < value.from) return false;
                if (value.to && d > value.to) return false;
                return true;
              }
            : // Filter on the displayed text so matches line up with what the user sees.
              (row, columnId, value: string) =>
                formatCell(row.original[columnId]).toLowerCase().includes(String(value).toLowerCase()),
      })),
    [columns, dateCol?.id]
  );

  // Resolve TanStack updater-or-value so controlled parents receive plain values.
  const resolve = <T,>(prev: T, updater: T | ((old: T) => T)): T =>
    typeof updater === "function" ? (updater as (old: T) => T)(prev) : updater;

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting, globalFilter, columnFilters, columnVisibility },
    getRowId: (_row, index) => String(keys ? keys[index] : index),
    onSortingChange: (u) => setSorting(resolve(sorting, u)),
    onGlobalFilterChange: (u) => setGlobalFilter(resolve(globalFilter, u)),
    onColumnFiltersChange: (u) => setColumnFilters(resolve(columnFilters, u)),
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, columnId, value: string) =>
      formatCell(row.original[columnId]).toLowerCase().includes(value.toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visibleCols = table.getVisibleLeafColumns();
  const bodyRows = table.getRowModel().rows;
  const activeFilters = columnFilters.length + (globalFilter ? 1 : 0);

  const colType = (col: ParsedColumn) => col.typeOverride ?? col.inferredType;

  const dateFilter = (dateCol ? table.getColumn(dateCol.id)?.getFilterValue() : undefined) as
    | { from?: string; to?: string }
    | undefined;
  const setDateFilter = (next: { from?: string; to?: string }) => {
    if (!dateCol) return;
    table.getColumn(dateCol.id)?.setFilterValue(next.from || next.to ? next : undefined);
  };

  const commitEdit = () => {
    if (editing) {
      const col = columns.find((c) => c.id === editing.colId);
      if (col) onEditCell?.(editing.rowIndex, col, editValue);
    }
    setEditing(null);
  };

  const download = async () => {
    const XLSX = await import("xlsx");
    const header = columns.map((c) => c.name);
    const aoa = [
      header,
      ...rows.map((r) => columns.map((c) => (r[c.id]?.raw == null ? null : (r[c.id]?.normalized ?? r[c.id]?.raw ?? null)))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${(label ?? "data").replace(/\s+/g, "_")}.xlsx`);
    onDownload?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search all columns…"
          className="h-8 w-56"
          aria-label="Search rows"
        />
        {dateCol && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-0.5">
            <span className="text-xs text-muted-foreground">{dateCol.name}</span>
            <Input
              type="date"
              value={dateFilter?.from ?? ""}
              max={dateFilter?.to || undefined}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              className="h-6 w-[8.5rem] text-xs"
              aria-label={`${dateCol.name} from`}
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={dateFilter?.to ?? ""}
              min={dateFilter?.from || undefined}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              className="h-6 w-[8.5rem] text-xs"
              aria-label={`${dateCol.name} to`}
            />
          </div>
        )}
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setShowFilters((v) => !v)}
        >
          {showFilters ? "Hide column filters" : "Column filters"}
        </Button>
        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setColumnFilters([]);
              setGlobalFilter("");
            }}
          >
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {onAddRow && (
            <Button variant="outline" size="sm" className="h-8" onClick={onAddRow}>
              <Plus className="size-3.5" /> Add row
            </Button>
          )}
          <FormulaPanel columns={columns} onDeleteColumn={onDeleteColumn} />
          {onAddColumn && <AddColumnDialog columns={columns} sampleRow={rows[0]} onAdd={onAddColumn} />}
          <Button variant="outline" size="sm" className="h-8" onClick={() => void download()}>
            <Download className="size-3.5" /> Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
              Columns
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              {table.getAllLeafColumns().map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                >
                  {(c.columnDef.meta as ParsedColumn).name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card"
        style={accentColor ? { borderTopColor: accentColor, borderTopWidth: 3 } : undefined}
      >
        <table className="w-full border-collapse text-sm" role="grid">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-10 border-r border-b border-border bg-muted px-1 py-1 text-center text-xs font-normal text-muted-foreground" />
              {table.getHeaderGroups()[0].headers.map((header) => {
                const col = header.column.columnDef.meta as ParsedColumn;
                const sorted = header.column.getIsSorted();
                const isCalc = col.formula != null;
                const numeric = NUMERIC.has(colType(col));
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "min-w-24 border-r border-b border-border/60 px-3 py-2 text-left whitespace-nowrap",
                      numeric ? NUM_TINT : "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                        title={col.formula ? `= ${col.formula}` : (col.originalHeader ?? col.name)}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isCalc && (
                          <span className="font-normal text-muted-foreground/70" aria-label="computed column">
                            ƒ
                          </span>
                        )}
                        <span className="ml-auto pl-1 text-xs text-primary" aria-hidden>
                          {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                        </span>
                      </button>
                      {isCalc && onDeleteColumn && (
                        <button
                          type="button"
                          onClick={() => onDeleteColumn(col.id)}
                          className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove column ${col.name}`}
                          title="Remove column"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
            {showFilters && (
              <tr>
                <th className="sticky left-0 z-20 w-10 border-r border-b border-border bg-muted p-0" />
                {table.getHeaderGroups()[0].headers.map((header) =>
                  header.column.id === dateCol?.id ? (
                    <th key={header.id} className="border-r border-b border-border/60 bg-muted p-1 text-center text-[11px] font-normal text-muted-foreground">
                      use range ↑
                    </th>
                  ) : (
                    <th key={header.id} className="border-r border-b border-border/60 bg-muted p-1">
                      <Input
                        value={(header.column.getFilterValue() as string) ?? ""}
                        onChange={(e) => header.column.setFilterValue(e.target.value)}
                        placeholder="Filter…"
                        className="h-6 w-full min-w-20 text-xs font-normal"
                        aria-label={`Filter ${(header.column.columnDef.meta as ParsedColumn).name}`}
                      />
                    </th>
                  )
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {bodyRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + 1}
                  className="h-20 border-b border-border text-center text-muted-foreground"
                >
                  {rows.length === 0 ? "This table has no data rows." : "No rows match the current filters."}
                </td>
              </tr>
            ) : (
              bodyRows.map((row, i) => {
                const origIndex = Number(row.id);
                return (
                <tr key={row.id} className="group/row hover:bg-muted/40">
                  <td className="sticky left-0 z-[5] w-10 border-r border-b border-border/60 bg-muted p-0 text-center text-xs text-muted-foreground tabular-nums">
                    {onDeleteRow ? (
                      <>
                        <span className="px-1 py-1 group-hover/row:hidden">{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteRow(origIndex, i + 1)}
                          className="hidden size-full place-items-center py-1 text-muted-foreground hover:text-destructive group-hover/row:grid"
                          aria-label={`Delete row ${i + 1}`}
                          title="Delete row"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="px-1 py-1">{i + 1}</span>
                    )}
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const col = cell.column.columnDef.meta as ParsedColumn;
                    const text = formatCell(row.original[col.id]);
                    const numeric = NUMERIC.has(colType(col));
                    const canEdit = onEditCell != null && col.formula == null;
                    const isEditing = editing?.rowIndex === origIndex && editing?.colId === col.id;

                    if (isEditing) {
                      return (
                        <td key={cell.id} className="border border-ring bg-background p-0">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              else if (e.key === "Escape") setEditing(null);
                            }}
                            className={cn(
                              "w-full bg-transparent px-2 py-1 text-sm outline-none",
                              numeric && "text-right tabular-nums"
                            )}
                            aria-label={`Edit ${col.name}`}
                          />
                        </td>
                      );
                    }

                    const note = notes?.[editKey(origIndex, col.id)];
                    const rawVal = row.original[col.id]?.normalized;
                    const change = isChangeCol(col.name) && typeof rawVal === "number" ? rawVal : null;
                    return (
                      <td
                        key={cell.id}
                        onDoubleClick={
                          canEdit
                            ? () => {
                                setEditing({ rowIndex: origIndex, colId: col.id });
                                setEditValue(text);
                              }
                            : undefined
                        }
                        className={cn(
                          "group/cell relative max-w-64 truncate border-b border-border/40 px-3 py-1.5 whitespace-nowrap",
                          numeric && cn("text-right tabular-nums", NUM_TINT),
                          change != null && change > 0 && "font-medium text-emerald-600 dark:text-emerald-400",
                          change != null && change < 0 && "font-medium text-red-600 dark:text-red-400",
                          canEdit && "cursor-cell"
                        )}
                        title={canEdit ? "Double-click to edit" : text}
                      >
                        {text}
                        {onSetNote && (
                          <CellNote
                            note={note}
                            accent={accentColor ?? "var(--chart-4)"}
                            label={`${col.name}, row ${i + 1}`}
                            onChange={(t) => onSetNote(origIndex, col, t)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 shrink-0 text-sm text-muted-foreground">
        {bodyRows.length === rows.length
          ? `${totalRowCount.toLocaleString()} rows`
          : `${bodyRows.length.toLocaleString()} of ${rows.length.toLocaleString()} rows match`}
        {previewTruncated &&
          ` (previewing first ${rows.length.toLocaleString()} of ${totalRowCount.toLocaleString()} — full data in the JSON export)`}
      </p>
    </div>
  );
}
