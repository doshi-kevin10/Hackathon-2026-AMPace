/**
 * Composition layer: turn a company's daily series + a validated request into
 * one deterministic analytics bundle (series, comparison, baseline, trend,
 * anomalies, drivers, data-quality). All sub-parts are individually unit-tested;
 * this just wires them and applies the request's range/granularity/windows.
 * `now` is injected so the engine stays pure.
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import { CANONICAL_FIELDS, CANONICAL_FIELD_LIST, type CanonicalFieldId, type FieldFormat } from "@/lib/metrics/canonical-registry";
import type { DailySeries } from "@/lib/databricks/history";
import { computeBaseline, type MetricBaseline } from "./baseline";
import { comparePeriods, resolveComparisonRange, type ComparisonMode, type DateRange, type PeriodComparison } from "./comparison";
import { analyzeCorrelation, type CorrelationResult } from "./correlation";
import { assessDataQuality, type DataQualityReport } from "./data-quality";
import { decomposeMetric, type DecomposableMetric, type DriverDecomposition } from "./drivers";
import { detectRobustAnomalies, type AnomalyEvent } from "./robust-anomalies";
import { bucketByGranularity, filterByRange, seriesValues, totalsOf, type Granularity } from "./series";
import { analyzeTrend, type TrendResult } from "./trend";

export const NUMERIC_FIELDS: CanonicalFieldId[] = CANONICAL_FIELD_LIST.filter(
  (f) => f.semantic.kind === "additive" || f.semantic.kind === "ratio"
).map((f) => f.id);

const DECOMPOSABLE: DecomposableMetric[] = ["revenue", "conversions", "roas", "cpc"];

export interface AnalyticsRequest {
  from?: string;
  to?: string;
  granularity?: Granularity;
  metrics?: CanonicalFieldId[];
  comparisonMode?: ComparisonMode;
  customComparison?: DateRange;
  rollingWindows?: number[];
  /** Reference date for staleness (ISO). */
  asOf?: string;
}

export interface SeriesPointView {
  key: string;
  label: string;
  value: number | null;
}

export interface SeriesView {
  field: CanonicalFieldId;
  label: string;
  format: FieldFormat;
  decimals: number;
  points: SeriesPointView[];
}

export interface TrendView extends TrendResult {
  field: CanonicalFieldId;
}

export interface AnalyticsBundle {
  company: string;
  range: DateRange;
  granularity: Granularity;
  latestDate: string | null;
  observations: number;
  metrics: CanonicalFieldId[];
  series: SeriesView[];
  comparison: PeriodComparison;
  baseline: MetricBaseline[];
  trends: TrendView[];
  anomalies: AnomalyEvent[];
  drivers: DriverDecomposition[];
  dataQuality: DataQualityReport;
  fetchedAt: string;
}

export function buildAnalytics(series: DailySeries, req: AnalyticsRequest, now: string): AnalyticsBundle {
  const granularity = req.granularity ?? "day";
  const windows = req.rollingWindows ?? [7, 28];
  const metrics = req.metrics && req.metrics.length ? req.metrics : NUMERIC_FIELDS;
  const comparisonMode = req.comparisonMode ?? "previous_period";

  const allPoints = series.points;
  const from = req.from ?? allPoints[0]?.date ?? "";
  const to = req.to ?? series.latestDate ?? allPoints[allPoints.length - 1]?.date ?? "";
  const range: DateRange = { from, to };

  const filtered = filterByRange(allPoints, from, to);
  const buckets = bucketByGranularity(filtered, granularity);

  const seriesViews: SeriesView[] = metrics.map((field) => {
    const meta = CANONICAL_FIELDS[field];
    const values = seriesValues(buckets, field);
    return {
      field,
      label: meta.displayName,
      format: meta.format,
      decimals: meta.decimals,
      points: buckets.map((b, i) => ({ key: b.key, label: b.label, value: values[i] })),
    };
  });

  const comparison = comparePeriods(allPoints, range, comparisonMode, { custom: req.customComparison });

  const baseline = metrics.map((field) => computeBaseline(filtered, field, windows));

  const trends: TrendView[] = metrics.map((field) => ({
    field,
    ...analyzeTrend(seriesValues(buckets, field)),
  }));

  const anomalies = detectRobustAnomalies(filtered);

  // Drivers: current range vs resolved comparison range.
  const cmpRange = resolveComparisonRange(range, comparisonMode, req.customComparison);
  const currentTotals = totalsOf(filtered);
  const comparisonTotals = cmpRange ? totalsOf(filterByRange(allPoints, cmpRange.from, cmpRange.to)) : totalsOf([]);
  const drivers = DECOMPOSABLE.map((m) => decomposeMetric(m, currentTotals, comparisonTotals));

  const dataQuality = assessDataQuality(filtered, {
    asOf: req.asOf,
    duplicateDates: series.duplicateDates,
  });

  return {
    company: series.name,
    range,
    granularity,
    latestDate: series.latestDate,
    observations: filtered.length,
    metrics,
    series: seriesViews,
    comparison,
    baseline,
    trends,
    anomalies,
    drivers,
    dataQuality,
    fetchedAt: now,
  };
}

export interface CorrelationRequest {
  metricA: CanonicalFieldId;
  metricB: CanonicalFieldId;
  from?: string;
  to?: string;
  minSamples?: number;
  maxLag?: number;
}

export interface CorrelationBundle extends CorrelationResult {
  metricA: CanonicalFieldId;
  metricB: CanonicalFieldId;
  labelA: string;
  labelB: string;
  scatter: { a: number; b: number; date: string }[];
}

/** Correlate two metrics over the daily series (date-aligned). */
export function buildCorrelation(series: DailySeries, req: CorrelationRequest): CorrelationBundle {
  const from = req.from ?? series.points[0]?.date ?? "";
  const to = req.to ?? series.latestDate ?? "";
  const filtered = filterByRange(series.points, from, to);
  const aVals = filtered.map((p) => canonicalValue(req.metricA, p));
  const bVals = filtered.map((p) => canonicalValue(req.metricB, p));
  const result = analyzeCorrelation(aVals, bVals, { minSamples: req.minSamples, maxLag: req.maxLag });

  const scatter = filtered
    .map((p, i) => ({ a: aVals[i], b: bVals[i], date: p.date }))
    .filter((s): s is { a: number; b: number; date: string } => s.a != null && s.b != null);

  return {
    ...result,
    metricA: req.metricA,
    metricB: req.metricB,
    labelA: CANONICAL_FIELDS[req.metricA].displayName,
    labelB: CANONICAL_FIELDS[req.metricB].displayName,
    scatter,
  };
}
