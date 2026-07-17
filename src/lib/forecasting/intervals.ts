/**
 * Residual-based empirical prediction intervals. For each step-ahead we take
 * the `level` quantile of the |backtest residuals| at that step as the interval
 * half-width, enforce that width is non-decreasing with the horizon (further =
 * more uncertain), and — for non-negative metrics — floor the lower bound at 0.
 *
 * This is a documented empirical heuristic, NOT a parametric confidence
 * interval. `method` records that honestly.
 */
import { percentile, stddev } from "@/lib/analytics/statistics";

export interface IntervalOptions {
  /** Quantile of |residuals| used as the half-width. Default 0.8. */
  level?: number;
  /** Floor the lower bound at 0 (spend/clicks/revenue/conversions cannot be negative). */
  nonNegative?: boolean;
}

export interface IntervalResult {
  lower: number[];
  upper: number[];
  method: string;
  level: number;
  /** Half-widths per step (for confidence's mean-relative-width). */
  halfWidths: number[];
}

/** Half-width for one step from its residuals; falls back to a scaled stddev, then null. */
function stepWidth(residuals: number[], level: number): number | null {
  const abs = residuals.map((r) => Math.abs(r)).filter((r) => Number.isFinite(r));
  if (abs.length >= 3) return percentile(abs, level * 100);
  const sd = stddev(residuals);
  if (sd != null) return 1.28 * sd; // ~80% one-sided normal fallback
  return abs.length ? abs[0] : null;
}

export function residualIntervals(
  pointForecast: number[],
  residualsByStep: number[][],
  opts: IntervalOptions = {}
): IntervalResult {
  const { level = 0.8, nonNegative = false } = opts;
  const halfWidths: number[] = [];
  let running = 0;
  for (let h = 0; h < pointForecast.length; h++) {
    const raw = stepWidth(residualsByStep[h] ?? [], level);
    // Non-decreasing: never let uncertainty shrink as we forecast further out.
    running = Math.max(running, raw ?? running);
    halfWidths.push(running);
  }

  const lower = pointForecast.map((p, h) => {
    const lo = p - halfWidths[h];
    return nonNegative ? Math.max(0, lo) : lo;
  });
  const upper = pointForecast.map((p, h) => p + halfWidths[h]);

  return { lower, upper, method: `residual-quantile-${Math.round(level * 100)}`, level, halfWidths };
}
