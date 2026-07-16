import type { CellValue, ParsedColumn, ParsedTable } from "@/lib/schemas/workbook";
import { evaluate, parseFormula, referencedNames } from "./formula";

export class ComputedColumnError extends Error {}

const findColumn = (table: ParsedTable, name: string): ParsedColumn | undefined =>
  table.columns.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());

const numberDisplay = (v: number): string =>
  v.toLocaleString("en", { maximumFractionDigits: 4 });

export interface ComputedSpec {
  name: string;
  formula: string;
  /** "percent" renders 0.034 as "3.40%" and types the column as percentage. */
  format?: "number" | "percent";
}

/**
 * Append a computed column to a table, evaluating the formula for every row
 * against the numeric (normalized) values of referenced columns.
 * Throws ComputedColumnError on name collisions or unknown references.
 */
export function applyComputedColumn(table: ParsedTable, spec: ComputedSpec): void {
  const name = spec.name.trim();
  if (findColumn(table, name)) {
    throw new ComputedColumnError(`A column named "${name}" already exists`);
  }

  const ast = parseFormula(spec.formula);
  const refs = new Map<string, ParsedColumn>();
  for (const ref of referencedNames(ast)) {
    const col = findColumn(table, ref);
    if (!col) {
      const available = table.columns.map((c) => `[${c.name}]`).join(", ");
      throw new ComputedColumnError(`Unknown column "${ref}". Available: ${available}`);
    }
    refs.set(ref, col);
  }

  const id = `col_${table.columns.length + 1}`;
  const percent = spec.format === "percent";

  for (const row of table.rows) {
    const value = evaluate(ast, (ref) => {
      const cell = row[refs.get(ref)!.id];
      const n = Number(cell?.normalized);
      return cell?.normalized != null && Number.isFinite(n) ? n : null;
    });
    const display =
      value == null ? null : percent ? `${(value * 100).toFixed(2)}%` : numberDisplay(value);
    row[id] = {
      raw: value,
      normalized: value,
      display,
      formula: spec.formula,
      type: value == null ? "empty" : percent ? "percentage" : "decimal",
    } satisfies CellValue;
  }

  table.columns.push({
    id,
    name,
    originalHeader: null,
    sheetColumn: -1,
    inferredType: percent ? "percentage" : "decimal",
    typeOverride: null,
    formula: spec.formula,
  });
}
