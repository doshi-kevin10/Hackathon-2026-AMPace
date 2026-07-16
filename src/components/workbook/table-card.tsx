"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { DataTable } from "@/components/tables/data-table";
import { CorrectionDialog } from "./correction-dialog";
import {
  ApiRequestError,
  fetchLiveTable,
  patchTable,
  type LiveTableResponse,
} from "@/lib/client-api";
import type { ParsedSheet, ParsedTable, ParsedWorkbook } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

interface TableCardProps {
  workbookId: string;
  sheet: ParsedSheet;
  table: ParsedTable;
  onUpdated: (wb: ParsedWorkbook) => void;
}

/** Confidence is shown as dot + text so it never relies on color alone. */
function ConfidenceIndicator({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const band = value >= 0.75 ? "high" : value >= 0.5 ? "medium" : "low";
  const dot =
    band === "high" ? "bg-emerald-500" : band === "medium" ? "bg-amber-500" : "bg-red-500";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={`Detection confidence: ${pct}% (${band})`}
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
      {pct}% confidence
    </span>
  );
}

/** Excel-style "add a formula column" dialog. */
function AddColumnDialog({
  workbookId,
  table,
  open,
  onOpenChange,
  onUpdated,
}: {
  workbookId: string;
  table: ParsedTable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (wb: ParsedWorkbook) => void;
}) {
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const wb = await patchTable(workbookId, table.id, {
        addColumn: { name: name.trim(), formula: formula.trim() },
      });
      onUpdated(wb);
      onOpenChange(false);
      setName("");
      setFormula("");
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Could not add the column.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            Define a new column with a formula over existing columns, like in Excel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nc-name">Column name</Label>
            <Input
              id="nc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Profit"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nc-formula">Formula</Label>
            <Input
              id="nc-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="= [Revenue] - [Total Adspend]"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use +, −, ×, ÷ and parentheses. Reference columns in brackets:{" "}
              {table.columns.slice(0, 4).map((c) => `[${c.name}]`).join(" ")}
              {table.columns.length > 4 && " …"}
            </p>
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
          <Button onClick={() => void submit()} disabled={busy || !name.trim() || !formula.trim()}>
            {busy ? "Adding…" : "Add column"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LIVE_POLL_MS = 30_000;

export function TableCard({ workbookId, sheet, table, onUpdated }: TableCardProps) {
  const [editing, setEditing] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveTableResponse | null>(null);

  // Once synced, the card mirrors the Databricks table and refreshes on an
  // interval — edits made in Databricks show up here automatically.
  const mapped = table.databricks?.table ?? null;
  useEffect(() => {
    if (!mapped || table.excluded) return;
    let cancelled = false;
    const pull = () =>
      fetchLiveTable(workbookId, table.id)
        .then((d) => !cancelled && setLive(d))
        .catch(() => !cancelled && setLive(null)); // fall back to the Excel snapshot
    pull();
    const timer = setInterval(pull, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workbookId, table.id, mapped, table.excluded]);

  const toggleExcluded = async () => {
    setBusy(true);
    try {
      onUpdated(await patchTable(workbookId, table.id, { excluded: !table.excluded }));
    } catch {
      // rich errors surface through the dialogs; keep the quick toggle silent-but-safe
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn(table.excluded && "opacity-60")}>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{table.name}</h3>
          {table.excluded && <Badge variant="outline">excluded</Badge>}
          {mapped && (
            <Badge
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
              title={`Mirrors ${live?.databricksTable ?? mapped} — refreshes every 30s${
                live ? ` · last update ${new Date(live.fetchedAt).toLocaleTimeString()}` : ""
              }`}
            >
              ⚡ Live · Databricks
            </Badge>
          )}
          <ConfidenceIndicator value={table.confidence} />
          <div className="ml-auto flex gap-2">
            {!table.excluded && (
              <Button variant="outline" size="sm" onClick={() => setAddingColumn(true)}>
                + Add column
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void toggleExcluded()} disabled={busy}>
              {table.excluded ? "Include" : "Exclude"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {sheet.name} · {table.range} · {table.rowCount.toLocaleString()} rows ×{" "}
          {table.columns.length} columns
          {live && ` · showing ${live.databricksTable}`}
        </p>
      </CardHeader>
      {!table.excluded && (
        <CardContent>
          {live ? (
            // key: column ids differ between the Excel snapshot and the live
            // Databricks view — remount so per-column state can't leak across.
            <DataTable
              key="live"
              columns={live.columns}
              rows={live.rows}
              totalRowCount={live.rows.length}
            />
          ) : (
            <DataTable
              key="excel"
              columns={table.columns}
              rows={table.rows}
              totalRowCount={table.rowCount}
              previewTruncated={table.previewTruncated}
            />
          )}
        </CardContent>
      )}

      {editing && (
        <CorrectionDialog
          key={table.id + table.range + table.headerRows.join(",")}
          workbookId={workbookId}
          sheet={sheet}
          table={table}
          open={editing}
          onOpenChange={setEditing}
          onUpdated={onUpdated}
        />
      )}
      <AddColumnDialog
        workbookId={workbookId}
        table={table}
        open={addingColumn}
        onOpenChange={setAddingColumn}
        onUpdated={onUpdated}
      />
    </Card>
  );
}
