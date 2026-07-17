/**
 * Per-metric historical baseline over the daily series: central tendency,
 * spread, percentiles, volatility, recent moving average/median for one or more
 * configurable windows, period-over-period growth, and trend direction.
 * Ratio fields use per-day ratio-of-sums via `canonicalValue`.
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import {
  coefficientOfVariation,
  max,
  mean,
  median,
  min,
  pctChanges,
  percentile,
  rollingMean,
  rollingMedian,
  stddev,
  volatility,
} from "./statistics";
import { analyzeTrend, type TrendOptions } from "./trend";
import type { DailyPoint } from "./series";

export interface RollingBaseline {
  window: number;
  movingAverage: number | null;
  movingMedian: number | null;
}

export interface MetricBaseline {
  field: CanonicalFieldId;
  observations: number;
  missing: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stddev: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  volatility: number | null;
  coefficientOfVariation: number | null;
  periodOverPeriodGrowth: number | null;
  trendDirection: "increasing" | "decreasing" | "flat";
  rolling: RollingBaseline[];
}

const lastNonNull = (xs: (number | null)[]): number | null => {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) return xs[i];
  return null;
};

export function computeBaseline(
  points: DailyPoint[],
  field: CanonicalFieldId,
  windows: number[] = [7, 28],
  trendOpts?: TrendOptions
): MetricBaseline {
  const values = points.map((pt) => canonicalValue(field, pt));
  const observations = values.filter((v) => v != null && Number.isFinite(v)).length;
  const changes = pctChanges(values);

  return {
    field,
    observations,
    missing: values.length - observations,
    mean: mean(values),
    median: median(values),
    min: min(values),
    max: max(values),
    stddev: stddev(values),
    p10: percentile(values, 10),
    p25: percentile(values, 25),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
    volatility: volatility(values),
    coefficientOfVariation: coefficientOfVariation(values),
    periodOverPeriodGrowth: changes.length ? changes[changes.length - 1] : null,
    trendDirection: analyzeTrend(values, trendOpts).direction,
    rolling: windows.map((window) => ({
      window,
      movingAverage: lastNonNull(rollingMean(values, window)),
      movingMedian: lastNonNull(rollingMedian(values, window)),
    })),
  };
}
