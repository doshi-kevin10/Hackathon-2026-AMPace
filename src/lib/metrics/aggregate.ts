/**
 * Period-level metric aggregation — the ratio-of-sums rule (§4.6). Additive
 * fields are summed; ratio fields (CPC/ROAS/CVR) are recomputed from the summed
 * components, never averaged from daily ratios. Zero denominator → null.
 *
 * Calc columns are aggregated by evaluating their (already-validated) formula
 * against the period-level canonical values, reusing the pure formula engine.
 */
import { evaluate, parseFormula } from "@/lib/excel/formula";
import type { CalcColumnSpec } from "@/lib/formula/calc-columns";
import {
  CANONICAL_FIELDS,
  CANONICAL_FIELD_LIST,
  type CanonicalFieldId,
} from "./canonical-registry";

/** Summed additive components for one period, plus row/day coverage. */
export interface PeriodTotals {
  total_adspend: number | null;
  clicks: number | null;
  revenue: number | null;
  conversions: number | null;
  /** Number of data rows (days) that contributed to the sums. */
  rowCount: number;
}

export const emptyTotals = (): PeriodTotals => ({
  total_adspend: null,
  clicks: null,
  revenue: null,
  conversions: null,
  rowCount: 0,
});

/** Value of a canonical field for a period. Ratios use ratio-of-sums; zero denom → null. */
export function canonicalValue(id: CanonicalFieldId, totals: PeriodTotals): number | null {
  const meta = CANONICAL_FIELDS[id];
  switch (meta.semantic.kind) {
    case "additive":
      return totals[id as "total_adspend" | "clicks" | "revenue" | "conversions"];
    case "ratio": {
      const num = totals[meta.semantic.numerator as keyof PeriodTotals] as number | null;
      const den = totals[meta.semantic.denominator as keyof PeriodTotals] as number | null;
      if (num == null || den == null || den === 0) return null;
      return num / den;
    }
    default:
      // temporal / dimension have no period-level numeric value
      return null;
  }
}

/** All canonical numeric field values for a period, keyed by display name (for formula resolution). */
export function canonicalValuesByDisplayName(totals: PeriodTotals): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const f of CANONICAL_FIELD_LIST) {
    if (f.semantic.kind === "additive" || f.semantic.kind === "ratio") {
      map.set(f.displayName.toLowerCase(), canonicalValue(f.id, totals));
    }
  }
  return map;
}

/**
 * Evaluate a calc column at the period level: its formula is applied to the
 * period-level canonical values (which are themselves ratio-of-sums correct).
 * Earlier calc columns are available to later ones, matching applyCalcColumns.
 * Returns null when the formula references an unknown column or produces null.
 */
export function calcColumnPeriodValue(
  spec: CalcColumnSpec,
  totals: PeriodTotals,
  priorCalcValues: Map<string, number | null> = new Map()
): number | null {
  let ast;
  try {
    ast = parseFormula(spec.formula);
  } catch {
    return null;
  }
  const base = canonicalValuesByDisplayName(totals);
  return evaluate(ast, (name) => {
    const key = name.toLowerCase();
    if (base.has(key)) return base.get(key) ?? null;
    if (priorCalcValues.has(key)) return priorCalcValues.get(key) ?? null;
    return null;
  });
}

/** Resolve any metric reference (canonical or calc) to its period value. */
export function metricPeriodValue(
  ref: { source: "canonical"; field: CanonicalFieldId } | { source: "calculated"; calculatedColumnId: string },
  totals: PeriodTotals,
  calcSpecs: CalcColumnSpec[]
): number | null {
  if (ref.source === "canonical") return canonicalValue(ref.field, totals);
  // Evaluate calc columns in order so earlier ones feed later ones.
  const values = new Map<string, number | null>();
  let target: number | null = null;
  for (const spec of calcSpecs) {
    const v = calcColumnPeriodValue(spec, totals, values);
    values.set(spec.name.toLowerCase(), v);
    if (spec.id === ref.calculatedColumnId) target = v;
  }
  return target;
}
