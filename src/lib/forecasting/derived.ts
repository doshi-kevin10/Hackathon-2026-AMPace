/**
 * Derive a ratio forecast (CPC, ROAS, CVR) from two component forecasts, so the
 * ratio is always coherent with its parts (see METRIC_SEMANTICS.md). Bounds are
 * propagated conservatively: a ratio is largest when the numerator is high and
 * the denominator is low, so lower = num.low/den.high and upper = num.high/den.low.
 * A zero/negative denominator yields 0 with a warning (never Infinity/NaN).
 */
import type { ForecastPoint } from "./types";

const safeDiv = (a: number, b: number): number => (b > 0 && Number.isFinite(a) ? a / b : 0);

export interface DerivedForecast {
  points: ForecastPoint[];
  warnings: string[];
}

export function deriveRatioForecast(numerator: ForecastPoint[], denominator: ForecastPoint[]): DerivedForecast {
  const warnings: string[] = [];
  const n = Math.min(numerator.length, denominator.length);
  const points: ForecastPoint[] = [];
  let zeroDen = 0;

  for (let i = 0; i < n; i++) {
    const num = numerator[i];
    const den = denominator[i];
    if (!(den.predicted > 0)) zeroDen++;
    points.push({
      date: num.date,
      predicted: safeDiv(num.predicted, den.predicted),
      lowerBound: safeDiv(num.lowerBound, den.upperBound),
      upperBound: safeDiv(num.upperBound, den.lowerBound),
    });
  }

  if (zeroDen > 0) warnings.push(`${zeroDen} forecast day(s) had a zero/negative denominator — ratio floored to 0 there.`);
  return { points, warnings };
}
