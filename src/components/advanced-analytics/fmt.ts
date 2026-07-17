/**
 * Client-side formatting + fixed color assignment for the analytics workspace.
 * Colors follow the ENTITY (canonical field), never its position in a filtered
 * list — a dataviz non-negotiable. Reuses the registry's authoritative formatter.
 */
import { CANONICAL_FIELDS, formatFieldValue, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import type { CanonicalMetricId } from "@/lib/analytics/request-schemas";
import type { Sentiment } from "@/lib/analytics/metric-direction";

/** Exact display of a metric value, per its registered format. */
export const formatMetric = (field: CanonicalFieldId, v: number | null): string => formatFieldValue(field, v);

/** Compact axis/label formatter honouring the field's unit (currency/percent). */
export function axisFormatter(field: CanonicalFieldId): (n: number) => string {
  const fmt = CANONICAL_FIELDS[field].format;
  return (n: number) => {
    if (!Number.isFinite(n)) return "—";
    if (fmt === "percentage") return `${(n * 100).toFixed(1)}%`;
    const compact =
      Math.abs(n) >= 1_000_000
        ? `${(n / 1_000_000).toFixed(1)}M`
        : Math.abs(n) >= 1_000
          ? `${(n / 1_000).toFixed(1)}K`
          : n.toLocaleString("en", { maximumFractionDigits: 2 });
    return fmt === "currency" ? `$${compact}` : compact;
  };
}

export const formatPct = (frac: number | null): string =>
  frac == null || !Number.isFinite(frac) ? "—" : `${frac >= 0 ? "+" : ""}${(frac * 100).toFixed(1)}%`;

export const formatSigned = (field: CanonicalFieldId, v: number | null): string => {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = formatFieldValue(field, Math.abs(v));
  return v < 0 ? `−${s}` : `+${s}`;
};

/** Tailwind text classes for a sentiment (favorable=green, unfavorable=red, neutral=muted). */
export const sentimentClass = (s: Sentiment): string =>
  s === "favorable"
    ? "text-emerald-600 dark:text-emerald-400"
    : s === "unfavorable"
      ? "text-destructive"
      : "text-muted-foreground";

/** Fixed categorical palette in canonical order — never cycled. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const FIELD_ORDER: CanonicalMetricId[] = ["total_adspend", "clicks", "cpc", "revenue", "conversions", "roas", "cvr"];

/** The selectable numeric metrics, in canonical order, with display labels. */
export const METRIC_OPTIONS: { id: CanonicalMetricId; label: string }[] = FIELD_ORDER.map((id) => ({
  id,
  label: CANONICAL_FIELDS[id].displayName,
}));

/** Metrics that can be forecast (components directly, ratios derived). */
export const FORECAST_METRICS = METRIC_OPTIONS;

/** Stable color for a canonical field (color follows the entity). */
export const colorForField = (field: CanonicalFieldId): string => {
  const i = (FIELD_ORDER as CanonicalFieldId[]).indexOf(field);
  return CHART_COLORS[(i < 0 ? 0 : i) % CHART_COLORS.length];
};
