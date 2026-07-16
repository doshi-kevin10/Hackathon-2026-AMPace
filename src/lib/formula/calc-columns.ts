import { evaluate, parseFormula, referencedNames } from "@/lib/excel/formula";
import type { CellValue, ColumnType, ParsedColumn } from "@/lib/schemas/workbook";

/**
 * User-defined calculated columns for the analytics grid. These are computed
 * client-side over the live Databricks rows — they are NEVER written back to
 * Databricks. The pure, eval-free formula engine (lib/excel/formula.ts) does
 * the parsing/evaluation; this module wires it to the row shape and formats.
 */

export type CalcFormat = "number" | "currency" | "percentage";

export interface CalcColumnSpec {
  id: string;
  name: string;
  formula: string;
  format: CalcFormat;
}

interface Table {
  columns: ParsedColumn[];
  rows: Record<string, CellValue>[];
}

export const calcColumnId = (specId: string): string => `calc_${specId}`;

const FORMAT_TYPE: Record<CalcFormat, ColumnType> = {
  number: "decimal",
  currency: "currency",
  percentage: "percentage",
};

const formatValue = (v: number | null, fmt: CalcFormat): string | null => {
  if (v == null) return null;
  if (fmt === "currency") return `$${v.toLocaleString("en", { maximumFractionDigits: 2 })}`;
  if (fmt === "percentage") return `${(v * 100).toFixed(2)}%`;
  return v.toLocaleString("en", { maximumFractionDigits: 4 });
};

const byName = (columns: ParsedColumn[]) => {
  const map = new Map<string, ParsedColumn>();
  for (const c of columns) map.set(c.name.toLowerCase(), c);
  return map;
};

/** Resolve a [column] reference to a finite number, or null (null propagates through the formula). */
const makeResolver =
  (lookup: Map<string, ParsedColumn>, row: Record<string, CellValue>) =>
  (ref: string): number | null => {
    const col = lookup.get(ref.toLowerCase());
    if (!col) return null;
    const raw = row[col.id]?.normalized;
    if (raw == null) return null; // Number(null) === 0, so guard before coercing
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

/**
 * Validate a spec against the columns available to it. Returns a friendly error
 * message, or null when the formula is valid. `existingNames` lets us reject
 * name collisions (canonical columns + already-added calc columns).
 */
export function validateCalcColumn(
  columns: ParsedColumn[],
  spec: { name: string; formula: string }
): string | null {
  const name = spec.name.trim();
  if (!name) return "Give the column a name.";
  if (columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return `A column named "${name}" already exists.`;
  }
  if (!spec.formula.trim()) return "Enter a formula.";

  let ast;
  try {
    ast = parseFormula(spec.formula);
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid formula.";
  }
  const lookup = byName(columns);
  for (const ref of referencedNames(ast)) {
    if (!lookup.has(ref.toLowerCase())) {
      return `Unknown column "${ref}". Available: ${columns.map((c) => `[${c.name}]`).join(", ")}`;
    }
  }
  return null;
}

/** Evaluate one spec against a single row's columns; used for the live preview. */
export function evaluateCalc(
  columns: ParsedColumn[],
  row: Record<string, CellValue>,
  spec: { formula: string; format: CalcFormat }
): { display: string | null; value: number | null } | { error: string } {
  let ast;
  try {
    ast = parseFormula(spec.formula);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid formula." };
  }
  const value = evaluate(ast, makeResolver(byName(columns), row));
  return { value, display: formatValue(value, spec.format) };
}

/**
 * Append every calc column to the table, in order. Each spec can reference the
 * base columns AND any earlier calc column (sequential resolution). Invalid
 * specs are skipped. Never mutates the input.
 */
export function applyCalcColumns(base: Table, specs: CalcColumnSpec[]): Table {
  if (specs.length === 0) return base;

  let columns = [...base.columns];
  let rows = base.rows.map((r) => ({ ...r }));

  for (const spec of specs) {
    if (validateCalcColumn(columns, spec)) continue; // skip invalid (e.g. a ref was deleted)
    let ast;
    try {
      ast = parseFormula(spec.formula);
    } catch {
      continue;
    }
    const lookup = byName(columns);
    const id = calcColumnId(spec.id);

    rows = rows.map((row) => {
      const value = evaluate(ast, makeResolver(lookup, row));
      const display = formatValue(value, spec.format);
      return {
        ...row,
        [id]: {
          raw: value,
          normalized: value,
          display,
          formula: spec.formula,
          type: value == null ? "empty" : FORMAT_TYPE[spec.format],
        } satisfies CellValue,
      };
    });

    columns = [
      ...columns,
      {
        id,
        name: spec.name,
        originalHeader: null,
        sheetColumn: -1,
        inferredType: FORMAT_TYPE[spec.format],
        typeOverride: null,
        formula: spec.formula,
      },
    ];
  }

  return { columns, rows };
}
