/**
 * The deterministic daily-series base that every advanced analytic consumes.
 *
 * A DailyPoint is structurally a metrics/aggregate `PeriodTotals` plus a date,
 * so `canonicalValue(id, point|bucket)` works directly on it and ratios stay
 * ratio-of-sums correct at every granularity. Bucketing sums the additive
 * components; ratios are NEVER pre-averaged — they are recomputed downstream
 * from the summed components (see METRIC_SEMANTICS.md).
 */
import { canonicalValue, type PeriodTotals } from "@/lib/metrics/aggregate";
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";

export type Granularity = "day" | "week" | "month";

/** One day's summed additive components. `date` is ISO `YYYY-MM-DD`. */
export interface DailyPoint extends PeriodTotals {
  date: string;
}

/** A granularity bucket: summed additive components over its member days. */
export interface Bucket extends PeriodTotals {
  /** Sort/identity key: ISO date (day/week-start) or `YYYY-MM` (month). */
  key: string;
  /** Human label for the x-axis. */
  label: string;
  /** ISO first and last member date. */
  start: string;
  end: string;
  /** Number of daily points that fell in this bucket. */
  dayCount: number;
}

const MS_PER_DAY = 86_400_000;

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Monday (ISO week start) of the week containing `iso`, as an ISO date. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const backToMonday = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - backToMonday);
  return isoDay(d);
}

/** Null-aware sum: null when no member had a finite value. */
const addNullable = (acc: number | null, v: number | null): number | null => {
  if (v == null || !Number.isFinite(v)) return acc;
  return (acc ?? 0) + v;
};

const emptyBucket = (key: string, label: string, start: string): Bucket => ({
  key,
  label,
  start,
  end: start,
  dayCount: 0,
  total_adspend: null,
  clicks: null,
  revenue: null,
  conversions: null,
  rowCount: 0,
});

function accumulate(bucket: Bucket, pt: DailyPoint): void {
  bucket.total_adspend = addNullable(bucket.total_adspend, pt.total_adspend);
  bucket.clicks = addNullable(bucket.clicks, pt.clicks);
  bucket.revenue = addNullable(bucket.revenue, pt.revenue);
  bucket.conversions = addNullable(bucket.conversions, pt.conversions);
  bucket.rowCount += pt.rowCount;
  bucket.dayCount += 1;
  if (pt.date < bucket.start) bucket.start = pt.date;
  if (pt.date > bucket.end) bucket.end = pt.date;
}

const keyFns: Record<Granularity, (iso: string) => { key: string; label: string }> = {
  day: (iso) => ({ key: iso, label: iso }),
  week: (iso) => {
    const k = weekStart(iso);
    return { key: k, label: `Wk of ${k}` };
  },
  month: (iso) => {
    const k = iso.slice(0, 7);
    return { key: k, label: k };
  },
};

/**
 * Group ascending daily points into buckets, summing additive components.
 * Output is sorted by key ascending. Ratios are obtained later via
 * `canonicalValue`/`seriesValues` — never stored pre-averaged.
 */
export function bucketByGranularity(points: DailyPoint[], granularity: Granularity): Bucket[] {
  const keyFn = keyFns[granularity];
  const map = new Map<string, Bucket>();
  for (const pt of points) {
    const { key, label } = keyFn(pt.date);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = emptyBucket(key, label, pt.date);
      map.set(key, bucket);
    }
    accumulate(bucket, pt);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The canonical value of one field across buckets (ratios via ratio-of-sums). */
export function seriesValues(buckets: readonly PeriodTotals[], field: CanonicalFieldId): (number | null)[] {
  return buckets.map((b) => canonicalValue(field, b));
}

/** Points whose date falls within [from, to] inclusive (ISO string compare). */
export const filterByRange = (points: DailyPoint[], from: string, to: string): DailyPoint[] =>
  points.filter((p) => p.date >= from && p.date <= to);

/** Sum additive components across points into a single PeriodTotals (ratio-of-sums base). */
export function totalsOf(points: DailyPoint[]): PeriodTotals {
  const totals: PeriodTotals = { total_adspend: null, clicks: null, revenue: null, conversions: null, rowCount: 0 };
  for (const pt of points) {
    totals.total_adspend = addNullable(totals.total_adspend, pt.total_adspend);
    totals.clicks = addNullable(totals.clicks, pt.clicks);
    totals.revenue = addNullable(totals.revenue, pt.revenue);
    totals.conversions = addNullable(totals.conversions, pt.conversions);
    totals.rowCount += pt.rowCount;
  }
  return totals;
}

/** ISO dates missing between the first and last point (calendar gaps). */
export function detectGaps(points: DailyPoint[]): string[] {
  if (points.length < 2) return [];
  const first = new Date(`${points[0].date}T00:00:00Z`).getTime();
  const last = new Date(`${points[points.length - 1].date}T00:00:00Z`).getTime();
  const present = new Set(points.map((p) => p.date));
  const missing: string[] = [];
  for (let t = first; t <= last; t += MS_PER_DAY) {
    const iso = isoDay(new Date(t));
    if (!present.has(iso)) missing.push(iso);
  }
  return missing;
}
