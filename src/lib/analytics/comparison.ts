/**
 * Period comparison: aggregate the current window and a resolved comparison
 * window (ratio-of-sums), then per canonical metric report current/comparison
 * values, absolute + percent change (reusing `observe`), and a direction-aware
 * sentiment (reusing `sentimentFor`). No metric is assumed "up = good".
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import { CANONICAL_FIELD_LIST, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import { observe, type MetricObservation } from "@/lib/metrics/observations";
import { sentimentFor, type Sentiment } from "./metric-direction";
import { filterByRange, totalsOf, type DailyPoint } from "./series";

export type ComparisonMode =
  | "previous_period"
  | "previous_week"
  | "previous_month"
  | "previous_quarter"
  | "previous_year"
  | "custom";

export interface DateRange {
  from: string;
  to: string;
}

export interface MetricComparison extends MetricObservation {
  field: CanonicalFieldId;
  sentiment: Sentiment;
}

export interface PeriodComparison {
  current: DateRange;
  comparison: DateRange | null;
  metrics: MetricComparison[];
}

const MS_PER_DAY = 86_400_000;
const asUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => iso(new Date(asUtc(isoDate).getTime() + days * MS_PER_DAY));
const addMonths = (isoDate: string, months: number) => {
  const d = asUtc(isoDate);
  d.setUTCMonth(d.getUTCMonth() + months);
  return iso(d);
};
const lengthDays = (r: DateRange) => Math.round((asUtc(r.to).getTime() - asUtc(r.from).getTime()) / MS_PER_DAY) + 1;

/** Resolve the comparison window for a mode, or null if it can't be formed. */
export function resolveComparisonRange(current: DateRange, mode: ComparisonMode, custom?: DateRange): DateRange | null {
  switch (mode) {
    case "previous_period": {
      const to = addDays(current.from, -1);
      return { from: addDays(to, -(lengthDays(current) - 1)), to };
    }
    case "previous_week":
      return { from: addDays(current.from, -7), to: addDays(current.to, -7) };
    case "previous_month":
      return { from: addMonths(current.from, -1), to: addMonths(current.to, -1) };
    case "previous_quarter":
      return { from: addMonths(current.from, -3), to: addMonths(current.to, -3) };
    case "previous_year":
      return { from: addMonths(current.from, -12), to: addMonths(current.to, -12) };
    case "custom":
      return custom ?? null;
  }
}

/** Canonical fields that carry a period-level numeric value (additive + ratio). */
const NUMERIC_FIELDS: CanonicalFieldId[] = CANONICAL_FIELD_LIST.filter(
  (f) => f.semantic.kind === "additive" || f.semantic.kind === "ratio"
).map((f) => f.id);

export function comparePeriods(
  points: DailyPoint[],
  current: DateRange,
  mode: ComparisonMode,
  opts: { custom?: DateRange; epsilon?: number } = {}
): PeriodComparison {
  const comparison = resolveComparisonRange(current, mode, opts.custom);
  const currentTotals = totalsOf(filterByRange(points, current.from, current.to));
  const comparisonTotals = comparison ? totalsOf(filterByRange(points, comparison.from, comparison.to)) : null;

  const metrics = NUMERIC_FIELDS.map((field) => {
    const cur = canonicalValue(field, currentTotals);
    const cmp = comparisonTotals ? canonicalValue(field, comparisonTotals) : null;
    const obs = observe(cur, cmp);
    return { field, ...obs, sentiment: sentimentFor(field, obs.percentChange, opts.epsilon) };
  });

  return { current, comparison, metrics };
}
