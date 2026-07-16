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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CANONICAL_ORDER, isCanonicalTable } from "@/lib/excel/canonicalize";
import { formatCell } from "@/lib/format";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

type Row = Record<string, CellValue>;

const NUMERIC = new Set(["integer", "decimal", "currency", "percentage"]);

interface DataTableProps {
  columns: ParsedColumn[];
  rows: Row[];
  totalRowCount: number;
  previewTruncated?: boolean;
}

/** Excel-like grid: scrollable, gridlines, row numbers, sticky header, sort, global search + per-column filters. */
export function DataTable({ columns, rows, totalRowCount, previewTruncated }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showFilters, setShowFilters] = useState(true);

  // Ad-performance tables show the canonical metric columns by default; extra
  // source columns stay in the Columns menu. User calc columns (formula set)
  // are always shown — the user just created them.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!isCanonicalTable({ columns })) return {};
    // Keep canonical metrics + CPA (relabeled ROAS) + user calc columns visible;
    // only extra source columns start hidden.
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
        // Filter on the displayed text so matches line up with what the user sees.
        filterFn: (row, columnId, value: string) =>
          formatCell(row.original[columnId]).toLowerCase().includes(String(value).toLowerCase()),
      })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting, globalFilter, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
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

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search all columns…"
          className="h-8 w-56"
          aria-label="Search rows"
        />
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
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="ml-auto h-8" />}>
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

      <div className="max-h-[520px] overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm" role="grid">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-10 border border-border bg-muted px-1 py-1 text-center text-xs font-normal text-muted-foreground" />
              {table.getHeaderGroups()[0].headers.map((header) => {
                const col = header.column.columnDef.meta as ParsedColumn;
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className="min-w-24 border border-border bg-muted px-2 py-1.5 text-left font-semibold whitespace-nowrap"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                      title={col.formula ? `= ${col.formula}` : (col.originalHeader ?? col.name)}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {col.formula && (
                        <span className="font-normal text-muted-foreground" aria-label="computed column">
                          ƒ
                        </span>
                      )}
                      <span className="ml-auto pl-1 text-xs text-muted-foreground" aria-hidden>
                        {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
            {showFilters && (
              <tr>
                <th className="sticky left-0 z-20 w-10 border border-border bg-muted p-0" />
                {table.getHeaderGroups()[0].headers.map((header) => (
                  <th key={header.id} className="border border-border bg-muted p-1">
                    <Input
                      value={(header.column.getFilterValue() as string) ?? ""}
                      onChange={(e) => header.column.setFilterValue(e.target.value)}
                      placeholder="Filter…"
                      className="h-6 w-full min-w-20 text-xs font-normal"
                      aria-label={`Filter ${(header.column.columnDef.meta as ParsedColumn).name}`}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {bodyRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + 1}
                  className="h-20 border border-border text-center text-muted-foreground"
                >
                  {rows.length === 0 ? "This table has no data rows." : "No rows match the current filters."}
                </td>
              </tr>
            ) : (
              bodyRows.map((row, i) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="sticky left-0 z-[5] w-10 border border-border bg-muted px-1 py-1 text-center text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const col = cell.column.columnDef.meta as ParsedColumn;
                    const text = formatCell(row.original[col.id]);
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "max-w-64 truncate border border-border/70 bg-background px-2 py-1 whitespace-nowrap",
                          NUMERIC.has(colType(col)) && "text-right tabular-nums"
                        )}
                        title={text}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {bodyRows.length === rows.length
          ? `${totalRowCount.toLocaleString()} rows`
          : `${bodyRows.length.toLocaleString()} of ${rows.length.toLocaleString()} rows match`}
        {previewTruncated &&
          ` (previewing first ${rows.length.toLocaleString()} of ${totalRowCount.toLocaleString()} — full data in the JSON export)`}
      </p>
    </div>
  );
}
