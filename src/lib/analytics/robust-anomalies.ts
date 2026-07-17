/**
 * Deterministic, robust anomaly detection. Instead of a global mean/stddev
 * (which floods when a series trends or steps), each point is compared to a
 * trailing rolling-median baseline; the residuals are scored with a
 * median+MAD robust z-score (Iglewicz–Hoaglin). Also flags unexpected zeros.
 * Ratio fields use per-day ratio-of-sums via `canonicalValue`.
 *
 * ponytail: global-window residual scale (one MAD over all residuals). A
 * per-window local scale would catch changing variance regimes — add if the
 * demo data shows heteroscedastic noise that this misses.
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import { median, rollingMedian, stddev } from "./statistics";
import type { DailyPoint } from "./series";

export type AnomalyMethod = "robust_z" | "zero_value";
export type AnomalySeverity = "low" | "medium" | "high";

export interface AnomalyEvent {
  field: CanonicalFieldId;
  date: string;
  value: number;
  expectedLow: number | null;
  expectedHigh: number | null;
  deviation: number; // |robust z-score|
  severity: AnomalySeverity;
  method: AnomalyMethod;
  context: string;
}

export interface AnomalyOptions {
  fields?: CanonicalFieldId[];
  /** Trailing window for the rolling-median baseline. */
  window?: number;
  /** Robust z threshold to flag. Default 3.5 (Iglewicz–Hoaglin). */
  threshold?: number;
}

const DEFAULT_FIELDS: CanonicalFieldId[] = [
  "total_adspend",
  "clicks",
  "revenue",
  "conversions",
  "cpc",
  "roas",
  "cvr",
];

/** {median, scale} where scale is a robust σ estimate (MAD/0.6745, or stddev if MAD=0). */
function robustStats(xs: number[]): { median: number; scale: number } {
  const med = median(xs) ?? 0;
  const mad = median(xs.map((x) => Math.abs(x - med))) ?? 0;
  const scale = mad > 0 ? mad / 0.6745 : (stddev(xs) ?? 0);
  return { median: med, scale };
}

/** Robust z-scores aligned to input; non-finite entries → null. */
export function robustZScores(values: (number | null)[]): (number | null)[] {
  const f = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (f.length === 0) return values.map(() => null);
  const { median: med, scale } = robustStats(f);
  return values.map((v) => (v == null || !Number.isFinite(v) || scale === 0 ? (v == null ? null : 0) : (v - med) / scale));
}

const severityFor = (z: number): AnomalySeverity => (z >= 5 ? "high" : z >= 4 ? "medium" : "low");
const SEV_RANK: Record<AnomalySeverity, number> = { low: 1, medium: 2, high: 3 };

export function detectRobustAnomalies(points: DailyPoint[], opts: AnomalyOptions = {}): AnomalyEvent[] {
  const { fields = DEFAULT_FIELDS, window = 14, threshold = 3.5 } = opts;
  const events: AnomalyEvent[] = [];

  for (const field of fields) {
    const values = points.map((pt) => canonicalValue(field, pt));
    const baseline = rollingMedian(values, window);
    const residuals = values.map((v, i) => (v != null && baseline[i] != null ? v - baseline[i]! : null));
    const finiteResid = residuals.filter((r): r is number => r != null);
    const seriesMedian = median(values) ?? 0;

    if (finiteResid.length >= 2) {
      const { median: rMed, scale } = robustStats(finiteResid);
      values.forEach((v, i) => {
        const r = residuals[i];
        if (v == null || r == null || scale === 0) return;
        const z = (r - rMed) / scale;
        if (Math.abs(z) < threshold) return;
        const base = baseline[i]!;
        events.push({
          field,
          date: points[i].date,
          value: v,
          expectedLow: base + rMed - threshold * scale,
          expectedHigh: base + rMed + threshold * scale,
          deviation: Math.abs(z),
          severity: severityFor(Math.abs(z)),
          method: "robust_z",
          context: `${z > 0 ? "Above" : "Below"} the trailing ${window}-point baseline by ${Math.abs(z).toFixed(1)}σ (robust).`,
        });
      });
    }

    // Unexpected zeros where the metric is normally positive.
    if (seriesMedian > 0) {
      values.forEach((v, i) => {
        if (v === 0) {
          events.push({
            field,
            date: points[i].date,
            value: 0,
            expectedLow: null,
            expectedHigh: null,
            deviation: 0,
            severity: "medium",
            method: "zero_value",
            context: `Zero value where the metric is usually positive (median ${seriesMedian.toFixed(2)}).`,
          });
        }
      });
    }
  }

  // Dedup by field+date keeping the highest severity, then sort by severity/deviation.
  const best = new Map<string, AnomalyEvent>();
  for (const e of events) {
    const key = `${e.field}:${e.date}`;
    const prev = best.get(key);
    if (!prev || SEV_RANK[e.severity] > SEV_RANK[prev.severity] || (e.severity === prev.severity && e.deviation > prev.deviation)) {
      best.set(key, e);
    }
  }
  return [...best.values()].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.deviation - a.deviation);
}
