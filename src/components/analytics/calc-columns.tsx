"use client";

import { useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  evaluateCalc,
  validateCalcColumn,
  type CalcColumnSpec,
  type CalcFormat,
} from "@/lib/formula/calc-columns";
import type { CellValue, ColumnType, ParsedColumn } from "@/lib/schemas/workbook";

const NUMERIC = new Set<ColumnType>(["integer", "decimal", "currency", "percentage"]);
const OPERATORS: { label: string; token: string }[] = [
  { label: "+", token: " + " },
  { label: "−", token: " - " },
  { label: "×", token: " * " },
  { label: "÷", token: " / " },
  { label: "(", token: "(" },
  { label: ")", token: ")" },
];

interface CalcColumnsProps {
  /** Columns available to reference (base canonical + already-added calc columns). */
  columns: ParsedColumn[];
  /** A representative row for the live preview. */
  sampleRow?: Record<string, CellValue>;
  specs: CalcColumnSpec[];
  onAdd: (spec: CalcColumnSpec) => void;
  onRemove: (id: string) => void;
}

export function CalcColumns({ columns, sampleRow, specs, onAdd, onRemove }: CalcColumnsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="text-sm font-medium">Calculations</span>
      {specs.length === 0 && (
        <span className="text-xs text-muted-foreground">
          Add a calculated column, e.g. Profit = Revenue − Total Adspend
        </span>
      )}
      {specs.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          title={`ƒ ${s.formula}`}
        >
          {s.name}
          <button
            type="button"
            onClick={() => onRemove(s.id)}
            className="rounded-full text-primary/70 hover:text-primary"
            aria-label={`Remove ${s.name}`}
          >
            ×
          </button>
        </span>
      ))}
      <Button variant="outline" size="sm" className="ml-auto h-8" onClick={() => setOpen(true)}>
        + Add calculation
      </Button>

      {open && (
        <AddCalcDialog
          columns={columns}
          sampleRow={sampleRow}
          open={open}
          onOpenChange={setOpen}
          onSave={(spec) => {
            onAdd(spec);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddCalcDialog({
  columns,
  sampleRow,
  open,
  onOpenChange,
  onSave,
}: {
  columns: ParsedColumn[];
  sampleRow?: Record<string, CellValue>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (spec: CalcColumnSpec) => void;
}) {
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [format, setFormat] = useState<CalcFormat>("number");

  const numericCols = useMemo(
    () => columns.filter((c) => NUMERIC.has(c.typeOverride ?? c.inferredType)),
    [columns]
  );

  const append = (token: string) => setFormula((f) => f + token);

  // Name/ref validity blocks saving; otherwise show a live preview on the sample row.
  const nameError = name.trim() && columns.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
    ? `A column named "${name.trim()}" already exists.`
    : null;
  const validationError = formula.trim() ? validateCalcColumn(columns, { name: name.trim() || "x", formula }) : null;
  const preview = useMemo(() => {
    if (!formula.trim() || validationError || !sampleRow) return null;
    const r = evaluateCalc(columns, sampleRow, { formula, format });
    return "error" in r ? null : r.display ?? "—";
  }, [columns, sampleRow, formula, format, validationError]);

  const canSave = !!name.trim() && !!formula.trim() && !nameError && !validationError;

  const save = () => {
    if (!canSave) return;
    onSave({ id: crypto.randomUUID(), name: name.trim(), formula: formula.trim(), format });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add calculated column</DialogTitle>
          <DialogDescription>
            Pick columns and operators to build a formula — no syntax required. Computed live; your
            Databricks data is never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="calc-name">Column name</Label>
            <Input id="calc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Profit" />
          </div>

          <div className="grid gap-1.5">
            <Label>Formula</Label>
            <Input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Click columns and operators below…"
              className="font-mono"
              aria-label="Formula"
            />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {numericCols.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => append(`[${c.name}]`)}
                  className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {OPERATORS.map((op) => (
                <button
                  key={op.label}
                  type="button"
                  onClick={() => append(op.token)}
                  className="h-8 w-8 rounded-md border bg-muted text-sm font-semibold hover:bg-muted/70"
                >
                  {op.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFormula("")}
                className="ml-auto rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat((v as CalcFormat) ?? "number")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {nameError || validationError ? (
              <span className="text-destructive">{nameError || validationError}</span>
            ) : preview != null ? (
              <span className="text-muted-foreground">
                Preview (first row): <span className="font-semibold text-foreground">{preview}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Build a formula to see a preview.</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            Add column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
