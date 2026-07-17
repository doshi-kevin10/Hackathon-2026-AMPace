/**
 * The notification watchtower — deterministic, accurate cross-company alerts.
 * For each company it compares the last 7 days to the prior 7 (direction-aware,
 * ratio-of-sums correct), names the largest driver of a revenue move, and flags
 * robust anomalies. AI never generates these numbers — it may only phrase them.
 */
import { assessDataQuality } from "@/lib/analytics/data-quality";
import { comparePeriods } from "@/lib/analytics/comparison";
import { decomposeMetric } from "@/lib/analytics/drivers";
import { detectRobustAnomalies } from "@/lib/analytics/robust-anomalies";
import { filterByRange, totalsOf, type DailyPoint } from "@/lib/analytics/series";
import { CANONICAL_FIELDS, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";

export type Severity = "critical" | "warning" | "positive" | "info";
export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, warning: 3, positive: 2, info: 1 };

export interface Notification {
  id: string;
  kind: "change" | "anomaly" | "quality";
  company: string;
  companyLabel: string;
  severity: Severity;
  metric?: CanonicalFieldId;
  title: string;
  detail: string;
  date?: string;
  href: string;
  /**
   * Stable-per-occurrence key for Slack dedup (alert-store). Unlike `id` (a
   * React key), this folds in the period/latest date so a recurring condition
   * re-alerts on a fresh week rather than being suppressed forever.
   */
  alertKey?: string;
}

export interface CompanyInput {
  name: string;
  label: string;
  points: DailyPoint[];
}

const WATCH: CanonicalFieldId[] = ["revenue", "roas", "cpc", "cvr", "conversions"];
const CHANGE_THRESHOLD = 0.12; // 12% week-over-week to be worth a notification
const CRITICAL_THRESHOLD = 0.3;

const fmt = (field: CanonicalFieldId, v: number | null) => {
  if (v == null) return "—";
  const f = CANONICAL_FIELDS[field].format;
  if (f === "percentage") return `${(v * 100).toFixed(1)}%`;
  if (f === "currency") return `$${v.toLocaleString("en", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })}`;
  return v.toLocaleString("en", { maximumFractionDigits: 2 });
};
const pct = (v: number | null) => (v == null ? "" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`);

/** Notifications for one company (last 7d vs prior 7d + anomalies). */
export function notificationsForCompany({ name, label, points }: CompanyInput): Notification[] {
  const href = `/datasets/${name}/analytics`;
  const out: Notification[] = [];
  if (points.length < 14) return out;

  const to = points[points.length - 1].date;
  const from = points[points.length - 7].date;
  const cmp = comparePeriods(points, { from, to }, "previous_period");
  const cmpRange = cmp.comparison;

  for (const m of cmp.metrics) {
    if (!WATCH.includes(m.field)) continue;
    const change = m.percentChange;
    if (change == null || Math.abs(change) < CHANGE_THRESHOLD || m.sentiment === "neutral") continue;

    const severity: Severity =
      m.sentiment === "favorable" ? "positive" : Math.abs(change) >= CRITICAL_THRESHOLD ? "critical" : "warning";

    // Name the biggest driver for a revenue move.
    let driver = "";
    if (m.field === "revenue" && cmpRange) {
      const d = decomposeMetric("revenue", totalsOf(filterByRange(points, from, to)), totalsOf(filterByRange(points, cmpRange.from, cmpRange.to)));
      const top = d.contributions.filter((c) => c.contribution != null).sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0];
      if (top && d.method === "exact_lmdi") driver = ` — mostly ${top.factor}`;
    }

    out.push({
      id: `${name}:${m.field}:wow`,
      alertKey: `${name}:${m.field}:wow:${to}`,
      kind: "change",
      company: name,
      companyLabel: label,
      severity,
      metric: m.field,
      title: `${label} · ${CANONICAL_FIELDS[m.field].displayName} ${pct(change)} this week`,
      detail: `${fmt(m.field, m.currentValue)} vs ${fmt(m.field, m.comparisonValue)} the prior week${driver}.`,
      href,
    });
  }

  // Recent anomalies (last ~45 days): informational context, not "critical".
  // Genuinely-bad moves are already surfaced above as direction-aware changes.
  const topAnomaly = detectRobustAnomalies(points.slice(-45)).find((a) => a.severity !== "low");
  if (topAnomaly) {
    out.push({
      id: `${name}:${topAnomaly.field}:${topAnomaly.date}`,
      kind: "anomaly",
      company: name,
      companyLabel: label,
      severity: "info",
      metric: topAnomaly.field,
      title: `${label} · unusual ${CANONICAL_FIELDS[topAnomaly.field].displayName} on ${topAnomaly.date}`,
      detail: `${fmt(topAnomaly.field, topAnomaly.value)} vs an expected ${fmt(topAnomaly.field, topAnomaly.expectedLow)}–${fmt(topAnomaly.field, topAnomaly.expectedHigh)}.`,
      date: topAnomaly.date,
      href,
    });
  }

  // Keep each company's feed tight.
  return out.sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity]).slice(0, 3);
}

/**
 * Data-quality issues as notifications (last-date-scoped dedup key so a
 * persistent problem alerts once, not every poll). Pure — `asOf` is passed in,
 * never read from a clock. Gated at 14+ points so nascent datasets stay quiet,
 * and `insufficient_history` is excluded (a standing limitation, not an event).
 */
export function qualityNotifications(
  name: string,
  label: string,
  points: DailyPoint[],
  opts: { asOf: string; duplicateDates?: string[] }
): Notification[] {
  if (points.length < 14) return [];
  const latest = points[points.length - 1].date;
  const report = assessDataQuality(points, { asOf: opts.asOf, duplicateDates: opts.duplicateDates });
  return report.issues
    .filter((i) => i.severity !== "info" && i.code !== "insufficient_history")
    .map((i) => ({
      id: `${name}:dq:${i.code}`,
      alertKey: `${name}:dq:${i.code}:${latest}`,
      kind: "quality" as const,
      company: name,
      companyLabel: label,
      severity: i.severity,
      title: `${label} · data quality: ${i.code.replace(/_/g, " ")}`,
      detail: i.message,
      date: latest,
      href: `/datasets/${name}/analytics`,
    }));
}

/** Cross-company feed, most urgent first. */
export function buildNotifications(companies: CompanyInput[], limit = 15): Notification[] {
  const all = companies.flatMap(notificationsForCompany);
  return all.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, limit);
}
