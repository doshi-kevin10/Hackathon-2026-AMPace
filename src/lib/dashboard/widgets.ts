"use client";

/**
 * The agent-built analytics dashboard. Each company starts blank; the top-right
 * Analyst chatbot drops widgets onto it. Widget *selection* is deterministic and
 * hardcoded here (demo-safe — the same prompt always yields relevant analytics,
 * with no dependency on the LLM). Dashboards are per-company and local; nothing
 * is written back to Databricks. Persisted in localStorage, broadcast via a
 * window event so the chatbot and the canvas stay in sync.
 */

export type WidgetType = "kpi" | "line" | "barDow" | "compare" | "alerts" | "table" | "momentum";

export interface WidgetSpec {
  id: string;
  type: WidgetType;
  title: string;
  /** Canonical column name for line / barDow / table widgets. */
  metric?: string;
  /** For the cross-company comparison widget. */
  compareMetric?: "roas" | "spend";
  /** Grid width: 1 = half, 2 = full. */
  span: 1 | 2;
}

/** Color follows the metric (an entity), never its position — per the dataviz rules. */
export const METRIC_COLOR: Record<string, string> = {
  Revenue: "var(--chart-2)",
  ROAS: "var(--chart-1)",
  "Total Adspend": "var(--chart-6)",
  Clicks: "var(--chart-7)",
  Conversions: "var(--chart-5)",
  CVR: "var(--chart-3)",
  CPC: "var(--chart-4)",
  CPA: "var(--chart-8)",
};
export const colorForMetric = (name: string): string => METRIC_COLOR[name] ?? "var(--chart-1)";

const id = () => crypto.randomUUID();

/** Map free text to a canonical metric column, or null. */
function metricFromPrompt(p: string): string | null {
  if (/\broas|return on|efficien/.test(p)) return "ROAS";
  if (/\bspend|budget|\bcost|adspend|invest/.test(p)) return "Total Adspend";
  if (/\bclick/.test(p)) return "Clicks";
  if (/\bconvers|\bconv\b|purchase|acquisit/.test(p)) return "Conversions";
  if (/\bcvr|conversion rate/.test(p)) return "CVR";
  if (/\bcpc\b/.test(p)) return "CPC";
  if (/\brevenue|\bsales|income|earn/.test(p)) return "Revenue";
  return null;
}

/**
 * Deterministic prompt → widget(s). Always returns at least one widget, so any
 * demo prompt produces relevant, polished analytics.
 */
export function routePrompt(prompt: string): WidgetSpec[] {
  const p = prompt.toLowerCase();
  const metric = metricFromPrompt(p);
  const out: WidgetSpec[] = [];

  if (/alert|anomal|attention|issue|problem|insight|flag|risk|warn|watch/.test(p)) {
    out.push({ id: id(), type: "alerts", title: "Signals & alerts", span: 2 });
  }
  if (/compare|versus|\bvs\b|across|companies|accounts|benchmark|competitor|rank/.test(p)) {
    const compareMetric = /spend|budget|cost|invest/.test(p) ? "spend" : "roas";
    out.push({
      id: id(),
      type: "compare",
      title: `Company comparison — ${compareMetric === "spend" ? "ad spend" : "ROAS"}`,
      compareMetric,
      span: 2,
    });
  }
  if (/day of week|weekday|by day|which day|seasonal|cadence|pattern/.test(p)) {
    const m = metric ?? "Revenue";
    out.push({ id: id(), type: "barDow", title: `${m} by day of week`, metric: m, span: 1 });
  }
  if (/table|breakdown|\blist\b|\brows?\b|detail|top days|biggest|leaderboard/.test(p)) {
    const m = metric ?? "Revenue";
    out.push({ id: id(), type: "table", title: `Top days by ${m}`, metric: m, span: 1 });
  }
  if (/kpi|summary|overview|snapshot|headline|scorecard|\bmetrics\b|dashboard|health|how are we|performance/.test(p)) {
    out.push({ id: id(), type: "kpi", title: "KPI summary", span: 2 });
    out.push({ id: id(), type: "line", title: "Revenue over time", metric: "Revenue", span: 1 });
    out.push({ id: id(), type: "line", title: "ROAS over time", metric: "ROAS", span: 1 });
  }

  if (out.length === 0) {
    if (metric) {
      out.push({ id: id(), type: "line", title: `${metric} over time`, metric, span: 2 });
    } else {
      // Generic prompt → an impressive default combo.
      out.push({ id: id(), type: "kpi", title: "KPI summary", span: 2 });
      out.push({ id: id(), type: "line", title: "Revenue over time", metric: "Revenue", span: 2 });
    }
  }
  return out;
}

// ---------- per-company store ----------

const key = (name: string) => `ampulse:dashboard:${name}`;
const EVENT = "ampulse:dashboard";

export const getDashboard = (name: string): WidgetSpec[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key(name)) ?? "[]") as WidgetSpec[];
  } catch {
    return [];
  }
};

const write = (name: string, specs: WidgetSpec[]) => {
  localStorage.setItem(key(name), JSON.stringify(specs));
  window.dispatchEvent(new Event(EVENT));
};

export const addWidgets = (name: string, specs: WidgetSpec[]): void => {
  write(name, [...getDashboard(name), ...specs]);
};

export const removeWidget = (name: string, widgetId: string): void => {
  write(name, getDashboard(name).filter((w) => w.id !== widgetId));
};

export const clearDashboard = (name: string): void => write(name, []);

/**
 * Seed the always-on period-comparison widget once per company, so every
 * dashboard starts with it. Idempotent and removable — a per-company flag means
 * it won't reappear after the user deletes it.
 */
export const ensureDefaultWidgets = (name: string): void => {
  if (typeof window === "undefined") return;
  const seededKey = `ampulse:dashboard-seeded:${name}`;
  if (localStorage.getItem(seededKey)) return;
  localStorage.setItem(seededKey, "1");
  const existing = getDashboard(name);
  if (!existing.some((w) => w.type === "momentum")) {
    write(name, [{ id: id(), type: "momentum", title: "Momentum — vs yesterday · week · month", span: 2 }, ...existing]);
  }
};

export const subscribeDashboard = (cb: () => void): (() => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
