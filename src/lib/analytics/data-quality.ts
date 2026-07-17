/**
 * Deterministic data-quality assessment. Runs BEFORE advanced analytics and
 * gates forecasting: a low-quality or too-short series must never be silently
 * forecast. Pure — takes the daily series (and a few raw-layer facts) and
 * returns a 0–100 score, specific issues, and a forecast-eligibility flag.
 */
import { detectGaps, type DailyPoint } from "./series";

export type Severity = "info" | "warning" | "critical";

export interface DataQualityIssue {
  code: string;
  severity: Severity;
  message: string;
}

export interface DataQualityReport {
  score: number;
  observations: number;
  missingDates: string[];
  duplicateDates: string[];
  largestGapDays: number;
  latestDate: string | null;
  staleDays: number | null;
  issues: DataQualityIssue[];
  sufficientForForecast: boolean;
}

export interface DataQualityOptions {
  /** Reference date (ISO) for staleness; omit to skip the staleness check. */
  asOf?: string;
  /** Dates that appeared more than once in the raw source (dedup'd out of `points`). */
  duplicateDates?: string[];
  /** Min usable observations to allow forecasting at all. */
  minForecastObservations?: number;
  /** Staleness threshold in days before flagging. */
  staleThresholdDays?: number;
  /** A run of consecutive missing days at/above this is a "large gap". */
  largeGapDays?: number;
}

const SEVERITY_PENALTY: Record<Severity, number> = { info: 2, warning: 10, critical: 30 };
const MS_PER_DAY = 86_400_000;

const ADDITIVE: (keyof DailyPoint)[] = ["total_adspend", "clicks", "revenue", "conversions"];

/** Longest run of consecutive missing dates. */
function largestGap(missing: string[]): number {
  if (missing.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < missing.length; i++) {
    const prev = new Date(`${missing[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${missing[i]}T00:00:00Z`).getTime();
    if (cur - prev === MS_PER_DAY) run++;
    else run = 1;
    if (run > longest) longest = run;
  }
  return longest;
}

export function assessDataQuality(points: DailyPoint[], opts: DataQualityOptions = {}): DataQualityReport {
  const {
    asOf,
    duplicateDates = [],
    minForecastObservations = 42,
    staleThresholdDays = 3,
    largeGapDays = 5,
  } = opts;

  const issues: DataQualityIssue[] = [];
  const observations = points.length;
  const missingDates = detectGaps(points);
  const largestGapDays = largestGap(missingDates);
  const latestDate = points.length ? points[points.length - 1].date : null;

  // --- value integrity ---
  let negatives = 0;
  let nonFinite = 0;
  for (const pt of points) {
    for (const k of ADDITIVE) {
      const v = pt[k] as number | null;
      if (v == null) continue;
      if (!Number.isFinite(v)) nonFinite++;
      else if (v < 0) negatives++;
    }
  }
  if (negatives > 0)
    issues.push({ code: "negative_values", severity: "critical", message: `${negatives} negative metric value(s) — impossible for spend/clicks/revenue/conversions.` });
  if (nonFinite > 0)
    issues.push({ code: "non_finite_values", severity: "critical", message: `${nonFinite} non-finite (NaN/∞) metric value(s).` });

  // --- coverage ---
  if (missingDates.length > 0)
    issues.push({ code: "missing_dates", severity: missingDates.length >= largeGapDays ? "warning" : "info", message: `${missingDates.length} missing calendar date(s).` });
  if (largestGapDays >= largeGapDays)
    issues.push({ code: "large_gap", severity: "warning", message: `Largest gap is ${largestGapDays} consecutive days.` });
  if (duplicateDates.length > 0)
    issues.push({ code: "duplicate_dates", severity: "warning", message: `${duplicateDates.length} duplicate date(s) in the source.` });

  // --- history sufficiency ---
  if (observations < minForecastObservations)
    issues.push({ code: "insufficient_history", severity: "warning", message: `${observations} observations (< ${minForecastObservations} needed for a reliable forecast).` });

  // --- staleness ---
  let staleDays: number | null = null;
  if (asOf && latestDate) {
    staleDays = Math.round((new Date(`${asOf}T00:00:00Z`).getTime() - new Date(`${latestDate}T00:00:00Z`).getTime()) / MS_PER_DAY);
    if (staleDays > staleThresholdDays)
      issues.push({ code: "stale_data", severity: "warning", message: `Latest data is ${staleDays} days old (> ${staleThresholdDays}).` });
  }

  const score = Math.max(0, Math.min(100, 100 - issues.reduce((s, i) => s + SEVERITY_PENALTY[i.severity], 0)));
  const hasCritical = issues.some((i) => i.severity === "critical");
  const sufficientForForecast = observations >= minForecastObservations && !hasCritical;

  return {
    score,
    observations,
    missingDates,
    duplicateDates,
    largestGapDays,
    latestDate,
    staleDays,
    issues,
    sufficientForForecast,
  };
}
