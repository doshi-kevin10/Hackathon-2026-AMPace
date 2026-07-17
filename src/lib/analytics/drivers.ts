/**
 * Deterministic "why did this metric change?" decomposition between two
 * periods. Each supported metric is written as a product of factors with a sign
 * (numerator factors ^+1, denominator factors ^−1):
 *
 *   Revenue      = Clicks × CVR × RevPerConv
 *   Conversions  = Clicks × CVR
 *   ROAS         = Revenue × Spend^−1
 *   CPC          = Spend   × Clicks^−1
 *
 * When every factor and both period values are strictly positive we use the
 * **LMDI** (Logarithmic Mean Divisia Index), which gives an *exact additive*
 * attribution — the contributions sum precisely to the total change. Otherwise
 * we cannot take logs, so we return an honest *approximate* explanation (each
 * factor's percentage change) and say so. Exact vs approximate is always labelled.
 */
import type { PeriodTotals } from "@/lib/metrics/aggregate";
import { canonicalValue } from "@/lib/metrics/aggregate";
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";

export type DecomposableMetric = "revenue" | "conversions" | "roas" | "cpc";

interface Factor {
  name: string;
  current: number | null;
  comparison: number | null;
  sign: 1 | -1;
}

export interface DriverContribution {
  factor: string;
  /** Exact additive contribution to the metric change (LMDI). null when approximate. */
  contribution: number | null;
  /** Share of the total change, [-1..1]-ish. null when approximate or total change is 0. */
  sharePct: number | null;
  /** Factor's own percentage change (always available when both values finite & comparison ≠ 0). */
  factorChangePct: number | null;
  direction: "increase" | "decrease" | "none";
}

export interface DriverDecomposition {
  metric: DecomposableMetric;
  currentValue: number | null;
  comparisonValue: number | null;
  totalChange: number | null;
  method: "exact_lmdi" | "approximate";
  contributions: DriverContribution[];
  note?: string;
}

const ratio = (num: number | null, den: number | null): number | null =>
  num != null && den != null && den !== 0 ? num / den : null;

/** Logarithmic mean L(a,b) = (a−b)/ln(a/b); L(a,a)=a. Requires a,b > 0. */
function logMean(a: number, b: number): number {
  if (a === b) return a;
  return (a - b) / (Math.log(a) - Math.log(b));
}

function buildFactors(metric: DecomposableMetric, cur: PeriodTotals, cmp: PeriodTotals): Factor[] {
  switch (metric) {
    case "revenue":
      return [
        { name: "Clicks", current: cur.clicks, comparison: cmp.clicks, sign: 1 },
        { name: "CVR", current: ratio(cur.conversions, cur.clicks), comparison: ratio(cmp.conversions, cmp.clicks), sign: 1 },
        { name: "Revenue per conversion", current: ratio(cur.revenue, cur.conversions), comparison: ratio(cmp.revenue, cmp.conversions), sign: 1 },
      ];
    case "conversions":
      return [
        { name: "Clicks", current: cur.clicks, comparison: cmp.clicks, sign: 1 },
        { name: "CVR", current: ratio(cur.conversions, cur.clicks), comparison: ratio(cmp.conversions, cmp.clicks), sign: 1 },
      ];
    case "roas":
      return [
        { name: "Revenue", current: cur.revenue, comparison: cmp.revenue, sign: 1 },
        { name: "Total Adspend", current: cur.total_adspend, comparison: cmp.total_adspend, sign: -1 },
      ];
    case "cpc":
      return [
        { name: "Total Adspend", current: cur.total_adspend, comparison: cmp.total_adspend, sign: 1 },
        { name: "Clicks", current: cur.clicks, comparison: cmp.clicks, sign: -1 },
      ];
  }
}

const pctChange = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? (a - b) / b : null;

const dirOf = (v: number | null): DriverContribution["direction"] =>
  v == null || v === 0 ? "none" : v > 0 ? "increase" : "decrease";

export function decomposeMetric(metric: DecomposableMetric, current: PeriodTotals, comparison: PeriodTotals): DriverDecomposition {
  const factors = buildFactors(metric, current, comparison);
  const field = metric as CanonicalFieldId;
  const curVal = canonicalValue(field, current);
  const cmpVal = canonicalValue(field, comparison);
  const totalChange = curVal != null && cmpVal != null ? curVal - cmpVal : null;

  const allPositive =
    curVal != null &&
    cmpVal != null &&
    curVal > 0 &&
    cmpVal > 0 &&
    factors.every((f) => f.current != null && f.comparison != null && f.current > 0 && f.comparison > 0);

  if (allPositive) {
    const L = logMean(curVal!, cmpVal!);
    const contributions = factors.map((f) => {
      const contribution = L * f.sign * Math.log(f.current! / f.comparison!);
      return {
        factor: f.name,
        contribution,
        sharePct: totalChange && totalChange !== 0 ? contribution / totalChange : null,
        factorChangePct: pctChange(f.current, f.comparison),
        direction: dirOf(contribution),
      };
    });
    return { metric, currentValue: curVal, comparisonValue: cmpVal, totalChange, method: "exact_lmdi", contributions };
  }

  // Approximate explanation — no exact decomposition on non-positive values.
  const contributions = factors.map((f) => {
    const change = pctChange(f.current, f.comparison);
    return { factor: f.name, contribution: null, sharePct: null, factorChangePct: change, direction: dirOf(change) };
  });
  return {
    metric,
    currentValue: curVal,
    comparisonValue: cmpVal,
    totalChange,
    method: "approximate",
    contributions,
    note: "Exact decomposition needs strictly positive values in both periods; showing each factor's percentage change instead.",
  };
}
