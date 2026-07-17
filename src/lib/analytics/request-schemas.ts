/**
 * Zod request schemas for the analytics/forecast APIs. The frontend sends
 * structured, validated requests — NEVER raw SQL. `.strict()` rejects unknown
 * keys so a client can't smuggle extra fields into the engine.
 */
import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateStr = z.string().regex(ISO_DATE, "Expected an ISO date (YYYY-MM-DD)");

export const canonicalMetric = z.enum([
  "total_adspend",
  "clicks",
  "cpc",
  "revenue",
  "conversions",
  "roas",
  "cvr",
]);
export const granularity = z.enum(["day", "week", "month"]);
export const comparisonMode = z.enum([
  "previous_period",
  "previous_week",
  "previous_month",
  "previous_quarter",
  "previous_year",
  "custom",
]);

const dateRange = z.object({ from: dateStr, to: dateStr }).strict();

export const AnalyticsRequestSchema = z
  .object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    granularity: granularity.default("day"),
    metrics: z.array(canonicalMetric).max(9).optional(),
    comparisonMode: comparisonMode.default("previous_period"),
    customComparison: dateRange.optional(),
    rollingWindows: z.array(z.number().int().positive().max(365)).max(6).optional(),
  })
  .strict();

export const CorrelationRequestSchema = z
  .object({
    metricA: canonicalMetric,
    metricB: canonicalMetric,
    from: dateStr.optional(),
    to: dateStr.optional(),
    minSamples: z.number().int().min(2).max(365).optional(),
    maxLag: z.number().int().min(0).max(30).optional(),
  })
  .strict();

export const ForecastRequestSchema = z
  .object({
    metric: canonicalMetric,
    horizonDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    refresh: z.boolean().optional(),
  })
  .strict();

/** The numeric metrics selectable in the workspace / forecastable (7-field union, no date/day). */
export type CanonicalMetricId = z.infer<typeof canonicalMetric>;

export const ExplainRequestSchema = z
  .object({
    analytics: AnalyticsRequestSchema,
    forecast: z.object({ metric: canonicalMetric, horizonDays: z.union([z.literal(7), z.literal(14), z.literal(30)]) }).optional(),
  })
  .strict();

export type ExplainRequestBody = z.infer<typeof ExplainRequestSchema>;

export type AnalyticsRequestBody = z.infer<typeof AnalyticsRequestSchema>;
export type CorrelationRequestBody = z.infer<typeof CorrelationRequestSchema>;
export type ForecastRequestBody = z.infer<typeof ForecastRequestSchema>;
