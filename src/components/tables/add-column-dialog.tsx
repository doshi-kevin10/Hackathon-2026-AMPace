"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateCalc, validateCalcColumn, type CalcFormat } from "@/lib/formula/calc-columns";
import type { CellValue, ParsedColumn } from "@/lib/schemas/workbook";
import { cn } from "@/lib/utils";

const FORMATS: { key: CalcFormat; label: string }[] = [
  { key: "number", label: "Number" },
  { key: "currency", label: "Currency" },
  { key: "percentage", label: "Percent" },
];

/** Excel-style "add computed column" dialog: name + formula over other columns, with a live preview. */
export function AddColumnDialog({
  columns,
  sampleRow,
  onAdd,
}: {
  columns: ParsedColumn[];
  sampleRow?: Record<string, CellValue>;
  onAdd: (spec: { name: string; formula: string; format: CalcFormat }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [format, setFormat] = useState<CalcFormat>("number");

  const error = useMemo(
    () => (name || formula ? validateCalcColumn(columns, { name, formula }) : null),
    [columns, name, formula]
  );

  const preview = useMemo(() => {
    if (!formula.trim() || !sampleRow || error) return null;
    const r = evaluateCalc(columns, sampleRow, { formula, format });
    return "error" in r ? null : r.display ?? "—";
  }, [columns, sampleRow, formula, format, error]);

  const reset = () => {
    setName("");
    setFormula("");
    setFormat("number");
  };

  const submit = () => {
    if (validateCalcColumn(columns, { name, formula })) return;
    onAdd({ name: name.trim(), formula: formula.trim(), format });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-3.5" /> Add column
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a calculated column</DialogTitle>
          <DialogDescription>
            Computed from other columns, like Excel. Stays local — Databricks is never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="calc-name">Column name</Label>
            <Input id="calc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Profit margin" autoFocus />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="calc-formula">Formula</Label>
            <Input
              id="calc-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="[Revenue] - [Total Adspend]"
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {columns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormula((f) => `${f}${f && !/[\s([]$/.test(f) ? " " : ""}[${c.name}]`)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                  title={`Insert [${c.name}]`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Use + − × ÷ and ( ). Reference columns by clicking a chip or typing [Name].</p>
          </div>

          <div className="grid gap-1.5">
            <Label>Format</Label>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    format === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : preview != null ? (
            <p className="text-sm text-muted-foreground">
              Preview (first row): <span className="font-mono font-medium text-foreground">{preview}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit} disabled={!name.trim() || !formula.trim() || !!error}>
            Add column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
