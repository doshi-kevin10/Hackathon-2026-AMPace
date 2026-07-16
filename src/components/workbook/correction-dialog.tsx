"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiRequestError, patchTable } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import {
  COLUMN_TYPES,
  type ColumnType,
  type ParsedSheet,
  type ParsedTable,
  type ParsedWorkbook,
  type TablePatch,
} from "@/lib/schemas/workbook";

interface CorrectionDialogProps {
  workbookId: string;
  sheet: ParsedSheet;
  table: ParsedTable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (wb: ParsedWorkbook) => void;
}

export function CorrectionDialog({
  workbookId,
  sheet,
  table,
  open,
  onOpenChange,
  onUpdated,
}: CorrectionDialogProps) {
  const [name, setName] = useState(table.name);
  const [range, setRange] = useState(table.range);
  const [headerRowCount, setHeaderRowCount] = useState(String(table.headerRows.length));
  const [colNames, setColNames] = useState(() =>
    Object.fromEntries(table.columns.map((c) => [c.id, c.name]))
  );
  const [colTypes, setColTypes] = useState<Record<string, ColumnType>>(() =>
    Object.fromEntries(table.columns.map((c) => [c.id, c.typeOverride ?? c.inferredType]))
  );
  const [deleteIds, setDeleteIds] = useState<Set<string>>(new Set());
  const [splitAt, setSplitAt] = useState("");
  const [mergeWith, setMergeWith] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherTables = useMemo(
    () => sheet.tables.filter((t) => t.id !== table.id),
    [sheet.tables, table.id]
  );

  const run = async (patch: TablePatch) => {
    setBusy(true);
    setError(null);
    try {
      const wb = await patchTable(workbookId, table.id, patch);
      onUpdated(wb);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "The correction could not be applied.");
    } finally {
      setBusy(false);
    }
  };

  const toggleDelete = (id: string) => {
    setDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < table.columns.length - 1) next.add(id);
      return next;
    });
  };

  const applyEdits = () => {
    const patch: TablePatch = {};
    if (name.trim() && name !== table.name) patch.name = name.trim();
    if (range.toUpperCase() !== table.range.toUpperCase()) patch.range = range.trim();
    if (Number(headerRowCount) !== table.headerRows.length) {
      patch.headerRowCount = Number(headerRowCount);
    }
    const columns = table.columns.flatMap((c) => {
      if (deleteIds.has(c.id)) return [];
      const edits: { id: string; name?: string; typeOverride?: ColumnType | null } = { id: c.id };
      let changed = false;
      if (colNames[c.id]?.trim() && colNames[c.id] !== c.name) {
        edits.name = colNames[c.id].trim();
        changed = true;
      }
      const effective = c.typeOverride ?? c.inferredType;
      if (colTypes[c.id] !== effective) {
        edits.typeOverride = colTypes[c.id] === c.inferredType ? null : colTypes[c.id];
        changed = true;
      }
      return changed ? [edits] : [];
    });
    if (columns.length > 0) patch.columns = columns;
    if (deleteIds.size > 0) patch.deleteColumns = [...deleteIds];
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    void run(patch);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Correct “{table.name}”</DialogTitle>
          <DialogDescription>
            Fix anything the parser got wrong. Range and header changes re-read the original file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="t-name">Table name</Label>
            <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-range">Excel range</Label>
              <Input
                id="t-range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="B3:F20"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Header rows</Label>
              <Select
                value={headerRowCount}
                onValueChange={(v) => setHeaderRowCount(v ?? headerRowCount)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) =>
                      ({ "0": "No header", "1": "First row", "2": "First two rows" })[v] ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No header</SelectItem>
                  <SelectItem value="1">First row</SelectItem>
                  <SelectItem value="2">First two rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Columns</Label>
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
              {table.columns.map((c) => {
                const marked = deleteIds.has(c.id);
                return (
                  <div key={c.id} className={cn("flex items-center gap-2", marked && "opacity-50")}>
                    <Input
                      value={colNames[c.id] ?? ""}
                      onChange={(e) => setColNames({ ...colNames, [c.id]: e.target.value })}
                      className={cn("h-8", marked && "line-through")}
                      disabled={marked}
                      aria-label={`Rename column ${c.name}`}
                    />
                    <Select
                      value={colTypes[c.id]}
                      onValueChange={(v) => setColTypes({ ...colTypes, [c.id]: v as ColumnType })}
                      disabled={marked}
                    >
                      <SelectTrigger className="h-8 w-32 shrink-0" aria-label={`Type of column ${c.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                            {t === c.inferredType ? " (detected)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant={marked ? "outline" : "ghost"}
                      size="icon-sm"
                      className="shrink-0"
                      disabled={!marked && table.columns.length - deleteIds.size <= 1}
                      title={marked ? `Keep "${c.name}"` : `Delete "${c.name}"`}
                      aria-label={marked ? `Keep column ${c.name}` : `Delete column ${c.name}`}
                      onClick={() => toggleDelete(c.id)}
                    >
                      {marked ? <RotateCcw /> : <Trash2 className="text-destructive" />}
                    </Button>
                  </div>
                );
              })}
            </div>
            {table.columns.length - deleteIds.size <= 1 && (
              <p className="text-xs text-muted-foreground">A table must keep at least one column.</p>
            )}
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="t-split">Split at sheet row</Label>
              <div className="flex gap-2">
                <Input
                  id="t-split"
                  type="number"
                  min={table.source.startRow + 2}
                  max={table.source.endRow + 1}
                  value={splitAt}
                  onChange={(e) => setSplitAt(e.target.value)}
                  placeholder={`${table.source.startRow + 2}–${table.source.endRow + 1}`}
                  className="h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !splitAt}
                  onClick={() => void run({ splitAtRow: Number(splitAt) })}
                >
                  Split
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Second table starts at this row.</p>
            </div>

            <div className="grid gap-1.5">
              <Label>Merge with</Label>
              <div className="flex gap-2">
                <Select
                  value={mergeWith}
                  onValueChange={(v) => setMergeWith(v ?? "")}
                  disabled={otherTables.length === 0}
                >
                  <SelectTrigger className="h-8" aria-label="Merge with table">
                    <SelectValue
                      placeholder={otherTables.length === 0 ? "No other tables" : "Choose table"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {otherTables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.range})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !mergeWith}
                  onClick={() => void run({ mergeWithTableId: mergeWith })}
                >
                  Merge
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Combines both regions into one table.</p>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={applyEdits} disabled={busy}>
            {busy ? "Applying…" : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
