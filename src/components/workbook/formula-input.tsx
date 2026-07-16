"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ParsedColumn } from "@/lib/schemas/workbook";

interface FormulaInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  columns: ParsedColumn[];
  placeholder?: string;
}

/** label is what the button shows; token is what actually gets inserted into the formula. */
const OPERATORS: { label: string; token: string }[] = [
  { label: "+", token: "+" },
  { label: "−", token: "-" },
  { label: "×", token: "*" },
  { label: "÷", token: "/" },
  { label: "(", token: "(" },
  { label: ")", token: ")" },
];

/**
 * Excel-style formula editor: type directly, or click a column chip / operator
 * to insert it at the current cursor position, like clicking a cell while
 * writing a formula in Excel.
 */
export function FormulaInput({ id, value, onChange, columns, placeholder }: FormulaInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insert = (token: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    const pos = start + token.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="grid gap-1.5">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono"
      />
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-1.5">
        {columns.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">No columns to reference yet</span>
        ) : (
          columns.map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              size="xs"
              className="font-mono"
              title={`Insert [${c.name}]`}
              onClick={() => insert(`[${c.name}]`)}
            >
              {c.name}
            </Button>
          ))
        )}
        <span className="mx-1 h-5 w-px shrink-0 self-center bg-border" aria-hidden />
        {OPERATORS.map((op) => (
          <Button
            key={op.label}
            type="button"
            variant="outline"
            size="icon-xs"
            className="font-mono"
            title={`Insert ${op.label}`}
            onClick={() => insert(op.token)}
          >
            {op.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
