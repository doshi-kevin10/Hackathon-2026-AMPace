"use client";

import { Sigma, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ParsedColumn } from "@/lib/schemas/workbook";

/** The sheet's formula list: every calculated column, with its formula and a remove button. */
export function FormulaPanel({
  columns,
  onDeleteColumn,
}: {
  columns: ParsedColumn[];
  onDeleteColumn?: (columnId: string) => void;
}) {
  const formulas = columns.filter((c) => c.formula != null);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <Sigma className="size-3.5" /> Formulas{formulas.length ? ` (${formulas.length})` : ""}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Formulas on this sheet</p>
        {formulas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No formulas yet. Use “Add column” to create one.</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {formulas.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">= {c.formula}</div>
                </div>
                {onDeleteColumn && (
                  <button
                    type="button"
                    onClick={() => onDeleteColumn(c.id)}
                    aria-label={`Remove ${c.name}`}
                    title="Remove formula"
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
