/**
 * AMPace agent — an AI automation agent for ad managers. It answers with REAL
 * numbers by calling deterministic tools over the analytics/forecast engine, and
 * it can drive the UI (navigate/open a company). It never invents numbers and
 * emits clean plain text (no markdown). A deterministic mock keeps the demo
 * working with no API key.
 */
import { canonicalValue } from "@/lib/metrics/aggregate";
import { comparePeriods } from "@/lib/analytics/comparison";
import { analyzeTrend } from "@/lib/analytics/trend";
import { filterByRange, totalsOf } from "@/lib/analytics/series";
import { listDatasets } from "@/lib/databricks/analytics";
import { getDailySeries } from "@/lib/databricks/history";
import { getOrCreateForecast } from "@/lib/forecasting/service";
import type { ForecastableMetric } from "@/lib/forecasting/run";
import { getNotifications } from "@/lib/notifications/service";
import { CANONICAL_FIELDS, type CanonicalFieldId } from "@/lib/metrics/canonical-registry";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}
export interface AgentAction {
  type: "navigate";
  href: string;
  label: string;
}
export interface AgentReply {
  reply: string;
  actions: AgentAction[];
  mode: "anthropic" | "mock";
}

const fmt = (f: CanonicalFieldId, v: number | null) => {
  if (v == null) return "n/a";
  const fmtType = CANONICAL_FIELDS[f].format;
  if (fmtType === "percentage") return `${(v * 100).toFixed(1)}%`;
  if (fmtType === "currency") return `$${v.toLocaleString("en", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })}`;
  return v.toLocaleString("en", { maximumFractionDigits: 2 });
};

/** Remove any stray markdown so answers read as clean prose. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/^\s*[-•]\s+/gm, "• ")
    .trim();
}

// ---------- deterministic tools (shared by both modes) ----------

async function toolListCompanies() {
  const ds = await listDatasets();
  return ds.map((d) => ({ company: d.name, label: d.label, latestDate: d.latestDate, avgRoas: d.avgRoas, totalAdspend: d.totalAdspend }));
}

async function toolAnalytics(company: string, days = 30) {
  const { points, latestDate } = await getDailySeries(company);
  if (!points.length) return { error: "no data" };
  const from = points[Math.max(0, points.length - days)].date;
  const to = points[points.length - 1].date;
  const totals = totalsOf(filterByRange(points, from, to));
  const cmp = comparePeriods(points, { from: points[Math.max(0, points.length - 7)].date, to }, "previous_period");
  const metrics: Record<string, unknown> = {};
  for (const f of ["total_adspend", "clicks", "cpc", "revenue", "conversions", "roas", "cvr"] as CanonicalFieldId[]) {
    const values = points.map((p) => canonicalValue(f, p));
    metrics[f] = {
      value: canonicalValue(f, totals),
      display: fmt(f, canonicalValue(f, totals)),
      weekOverWeekPct: cmp.metrics.find((m) => m.field === f)?.percentChange ?? null,
      trend: analyzeTrend(values).direction,
    };
  }
  return { company, label: (await toolListCompanies()).find((c) => c.company === company)?.label ?? company, window: `${from}..${to} (${days}d)`, latestDate, metrics };
}

async function toolForecast(company: string, metric: CanonicalFieldId, horizonDays: number) {
  const fc = await getOrCreateForecast(company, metric as ForecastableMetric, horizonDays as 7 | 14 | 30);
  if (fc.status !== "ok" || !fc.result) return { status: fc.status, reason: fc.reason, allowedHorizons: fc.allowedHorizons };
  const pts = fc.result.points;
  const additive = ["total_adspend", "clicks", "revenue", "conversions"].includes(metric);
  const agg = (xs: number[]) => (additive ? xs.reduce((s, v) => s + v, 0) : xs.reduce((s, v) => s + v, 0) / xs.length);
  return {
    status: "ok",
    metric,
    horizonDays,
    model: fc.result.modelName,
    confidence: fc.result.confidence,
    backtestWapePct: fc.result.backtestMetrics.wape,
    pointEstimate: fmt(metric, agg(pts.map((p) => p.predicted))),
    low: fmt(metric, agg(pts.map((p) => p.lowerBound))),
    high: fmt(metric, agg(pts.map((p) => p.upperBound))),
    note: "Estimate from historical patterns; not a guarantee.",
  };
}

async function toolNotifications() {
  return (await getNotifications()).map((n) => ({ company: n.company, label: n.companyLabel, severity: n.severity, title: n.title, detail: n.detail }));
}

const METRIC_ALIASES: Record<string, CanonicalFieldId> = {
  revenue: "revenue", sales: "revenue", roas: "roas", cpc: "cpc", cvr: "cvr", conversion: "cvr", conversions: "conversions", clicks: "clicks", spend: "total_adspend", adspend: "total_adspend", budget: "total_adspend",
};

// ---------- mock agent (deterministic, no API key) ----------

async function runMock(messages: AgentMessage[]): Promise<AgentReply> {
  const q = (messages.filter((m) => m.role === "user").pop()?.content ?? "").toLowerCase();
  const companies = await toolListCompanies();
  const matched = companies.find((c) => q.includes(c.label.toLowerCase()) || q.includes(c.company));
  const actions: AgentAction[] = [];

  const metricKey = Object.keys(METRIC_ALIASES).find((k) => q.includes(k));
  const metric = metricKey ? METRIC_ALIASES[metricKey] : null;

  // forecast intent
  if (q.includes("forecast") || q.includes("predict") || q.includes("next")) {
    const co = matched ?? companies[0];
    const m = metric ?? "revenue";
    const horizon = q.includes("30") ? 30 : q.includes("7") ? 7 : 14;
    const f = await toolForecast(co.company, m, horizon);
    actions.push({ type: "navigate", href: `/datasets/${co.company}/analytics`, label: `Open ${co.label} forecast` });
    if (f.status !== "ok") return { mode: "mock", actions, reply: `I can't forecast ${CANONICAL_FIELDS[m].displayName} for ${co.label} yet — ${f.reason ?? "not enough history"}.` };
    return {
      mode: "mock",
      actions,
      reply: `${co.label} — ${CANONICAL_FIELDS[m].displayName} over the next ${horizon} days is projected around ${f.pointEstimate} (range ${f.low} to ${f.high}), using the ${f.model} model at ${f.confidence} confidence (backtest error ${f.backtestWapePct == null ? "n/a" : (f.backtestWapePct * 100).toFixed(1) + "%"}). This is an estimate from historical patterns, not a guarantee.`,
    };
  }

  // attention / today / summary intent
  if (q.includes("attention") || q.includes("today") || q.includes("wrong") || q.includes("summary") || q.includes("need") || q.includes("alert")) {
    const notes = await toolNotifications();
    if (!notes.length) return { mode: "mock", actions, reply: "All accounts look healthy right now — no urgent changes in the last week." };
    const top = notes.slice(0, 4);
    const lines = top.map((n) => `• ${n.title}. ${n.detail}`);
    if (top[0]) actions.push({ type: "navigate", href: `/datasets/${top[0].company}/analytics`, label: `Open ${top[0].label}` });
    return { mode: "mock", actions, reply: `Here's what needs your attention:\n${lines.join("\n")}` };
  }

  // open / show intent
  if (matched && (q.includes("open") || q.includes("show") || q.includes("go to") || q.includes("analytics"))) {
    actions.push({ type: "navigate", href: `/datasets/${matched.company}/analytics`, label: `Open ${matched.label}` });
    return { mode: "mock", actions, reply: `Opening ${matched.label}'s analytics.` };
  }

  // how is <company> / stats
  if (matched) {
    const a = await toolAnalytics(matched.company, 30);
    const M = a.metrics as Record<string, { display: string; weekOverWeekPct: number | null; trend: string }>;
    actions.push({ type: "navigate", href: `/datasets/${matched.company}/analytics`, label: `Open ${matched.label}` });
    const wow = (f: string) => (M[f].weekOverWeekPct == null ? "" : ` (${M[f].weekOverWeekPct! >= 0 ? "+" : ""}${(M[f].weekOverWeekPct! * 100).toFixed(0)}% WoW)`);
    return {
      mode: "mock",
      actions,
      reply: `${matched.label}, last 30 days: revenue ${M.revenue.display}${wow("revenue")}, ROAS ${M.roas.display}${wow("roas")}, CPC ${M.cpc.display}${wow("cpc")}, spend ${M.total_adspend.display}. Revenue trend is ${M.revenue.trend}.`,
    };
  }

  // default
  const list = companies.map((c) => c.label).join(", ");
  return {
    mode: "mock",
    actions,
    reply: `I watch your ad accounts (${list}) and flag what needs attention. Try: "what needs attention today?", "forecast Nike revenue next 14 days", or "how is Adidas doing?".`,
  };
}

// ---------- anthropic agent (tool loop) ----------

const TOOLS = [
  { name: "list_companies", description: "List all ad accounts with headline stats.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_company_analytics", description: "KPIs, week-over-week change, and trend for one company.", input_schema: { type: "object", properties: { company: { type: "string" }, days: { type: "number" } }, required: ["company"], additionalProperties: false } },
  { name: "forecast_metric", description: "Forecast a metric (revenue|total_adspend|clicks|conversions|cpc|roas|cvr) for 7, 14, or 30 days.", input_schema: { type: "object", properties: { company: { type: "string" }, metric: { type: "string" }, horizonDays: { type: "number" } }, required: ["company", "metric", "horizonDays"], additionalProperties: false } },
  { name: "get_notifications", description: "The cross-company alert feed (what needs attention).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "navigate", description: "Open a page in the app for the user (e.g. a company's analytics).", input_schema: { type: "object", properties: { href: { type: "string" }, label: { type: "string" } }, required: ["href", "label"], additionalProperties: false } },
];

const SYSTEM = [
  "You are AMPace, an AI automation agent for advertising managers.",
  "Answer using ONLY numbers returned by the tools. Never invent or estimate a number yourself.",
  "Always call a tool when a question needs data. Company ids look like 'excel_company_nike'.",
  "Whenever your answer focuses on one company, ALWAYS call navigate with href '/datasets/<company>/analytics' so the user can open it.",
  "Write plain conversational text. NO markdown, NO asterisks, NO headers, NO backticks. Use short lines or simple '•' bullets.",
  "Be concise and specific. Never claim a forecast is guaranteed, and never claim correlation is causation.",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
async function runTool(name: string, input: any): Promise<unknown> {
  if (name === "list_companies") return toolListCompanies();
  if (name === "get_company_analytics") return toolAnalytics(String(input.company), Number(input.days) || 30);
  if (name === "forecast_metric") return toolForecast(String(input.company), input.metric as CanonicalFieldId, Number(input.horizonDays) || 14);
  if (name === "get_notifications") return toolNotifications();
  return { ok: true };
}

async function runAnthropic(messages: AgentMessage[]): Promise<AgentReply> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.AMPACE_AGENT_MODEL ?? "claude-sonnet-5";
  const actions: AgentAction[] = [];
  const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }));

  let finalText = "";
  for (let step = 0; step < 6; step++) {
    const res: any = await client.messages.create({ model, max_tokens: 900, system: SYSTEM.join("\n"), tools: TOOLS as any, messages: convo });
    convo.push({ role: "assistant", content: res.content });
    const toolUses = res.content.filter((b: any) => b.type === "tool_use");
    finalText = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim() || finalText;
    if (toolUses.length === 0) break;

    const results: any[] = [];
    for (const tu of toolUses) {
      if (tu.name === "navigate") {
        actions.push({ type: "navigate", href: String(tu.input.href), label: String(tu.input.label) });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: "ok" });
      } else {
        const r = await runTool(tu.name, tu.input);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(r) });
      }
    }
    convo.push({ role: "user", content: results });
  }
  return { mode: "anthropic", reply: stripMarkdown(finalText) || "Done.", actions };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function runAgent(messages: AgentMessage[]): Promise<AgentReply> {
  const useAnthropic = process.env.AI_MODE === "anthropic" && Boolean(process.env.ANTHROPIC_API_KEY);
  const out = useAnthropic ? await runAnthropic(messages) : await runMock(messages);

  // Guarantee an "open" affordance when the conversation is about one company.
  let actions = out.actions;
  if (actions.length === 0) {
    const companies = await toolListCompanies();
    const text = `${messages.filter((m) => m.role === "user").pop()?.content ?? ""} ${out.reply}`.toLowerCase();
    const hit = companies.find((c) => text.includes(c.label.toLowerCase()) || text.includes(c.company));
    if (hit) actions = [{ type: "navigate", href: `/datasets/${hit.company}/analytics`, label: `Open ${hit.label}` }];
  }

  return { ...out, actions, reply: stripMarkdown(out.reply) };
}
