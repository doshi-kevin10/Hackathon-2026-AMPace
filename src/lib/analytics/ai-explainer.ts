/**
 * OPTIONAL AI explanation layer — added only after the deterministic analytics
 * work. It receives ONLY structured, server-computed results (never client
 * numbers, never SQL, never Databricks creds) and produces a plain-English
 * summary. It must never recompute or invent values, claim causation, or
 * present forecasts as guaranteed — the disclaimer is always attached.
 *
 * AI_MODE gates behaviour: disabled → not available (app still works); mock →
 * deterministic offline narrative built from the numbers; anthropic → Claude,
 * with a strict prompt. Reuses the project's AI_MODE convention.
 */
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";
import { formatFieldValue } from "@/lib/metrics/canonical-registry";
import type { Sentiment } from "./metric-direction";
import type { AnalyticsBundle } from "./engine";

export const DISCLAIMER =
  "This summary is based on historical patterns and does not guarantee future performance. Correlation does not imply causation.";

export type AiMode = "disabled" | "mock" | "anthropic";

export interface ForecastFactoid {
  metric: string;
  horizonDays: number;
  modelName: string;
  confidence: string;
  wape: number | null;
  expectedChangePct: number | null;
}

export interface ExplanationInput {
  company: string;
  range: { from: string; to: string };
  keyMetrics: { field: CanonicalFieldId; label: string; current: number | null; changePct: number | null; sentiment: Sentiment }[];
  trends: { field: CanonicalFieldId; direction: string; percentChange: number | null }[];
  topDrivers: { metric: string; factor: string; sharePct: number | null }[];
  anomalies: { field: CanonicalFieldId; date: string; severity: string }[];
  dataQuality: { score: number; sufficientForForecast: boolean; issues: string[] };
  forecast?: ForecastFactoid;
  warnings: string[];
}

export interface Explanation {
  mode: "mock" | "anthropic";
  summary: string;
  disclaimer: string;
}

/** Pull the structured facts the AI is allowed to see — straight from the deterministic bundle. */
export function buildExplanationInput(bundle: AnalyticsBundle, forecast?: ForecastFactoid): ExplanationInput {
  return {
    company: bundle.company,
    range: bundle.range,
    keyMetrics: bundle.comparison.metrics.map((m) => ({
      field: m.field,
      label: m.field,
      current: m.currentValue,
      changePct: m.percentChange,
      sentiment: m.sentiment,
    })),
    trends: bundle.trends.map((t) => ({ field: t.field, direction: t.direction, percentChange: t.percentChange })),
    topDrivers: bundle.drivers
      .filter((d) => d.method === "exact_lmdi")
      .flatMap((d) => d.contributions.map((c) => ({ metric: d.metric, factor: c.factor, sharePct: c.sharePct })))
      .filter((c) => c.sharePct != null)
      .sort((a, b) => Math.abs(b.sharePct!) - Math.abs(a.sharePct!))
      .slice(0, 4),
    anomalies: bundle.anomalies.slice(0, 5).map((a) => ({ field: a.field, date: a.date, severity: a.severity })),
    dataQuality: {
      score: bundle.dataQuality.score,
      sufficientForForecast: bundle.dataQuality.sufficientForForecast,
      issues: bundle.dataQuality.issues.map((i) => i.message),
    },
    forecast,
    warnings: [],
  };
}

const pct = (v: number | null): string => (v == null || !Number.isFinite(v) ? "n/a" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

/** Deterministic offline narrative — reads the numbers, never invents them. */
export function explainAnalyticsMock(input: ExplanationInput): Explanation {
  const lines: string[] = [];
  lines.push(`Over ${input.range.from} to ${input.range.to}, here is how ${input.company} performed:`);

  for (const m of input.keyMetrics.slice(0, 4)) {
    const meta = m.field as CanonicalFieldId;
    lines.push(
      `• ${m.label}: ${formatFieldValue(meta, m.current)} (${pct(m.changePct)} vs the comparison period — ${m.sentiment}).`
    );
  }

  const notableTrend = input.trends.find((t) => t.direction !== "flat");
  if (notableTrend) lines.push(`Trend: ${notableTrend.field} is ${notableTrend.direction} (${pct(notableTrend.percentChange)} over the period).`);

  if (input.topDrivers.length) {
    const d = input.topDrivers[0];
    lines.push(`Largest driver: ${d.factor} accounts for ${pct(d.sharePct)} of the change in ${d.metric}.`);
  }

  if (input.anomalies.length) lines.push(`${input.anomalies.length} anomaly(ies) flagged, most recent on ${input.anomalies[0].date} (${input.anomalies[0].severity}).`);

  lines.push(`Data quality: ${input.dataQuality.score}/100 — forecasting is ${input.dataQuality.sufficientForForecast ? "enabled" : "limited"}.`);

  if (input.forecast) {
    lines.push(
      `Forecast: ${input.forecast.metric} over ${input.forecast.horizonDays} days via ${input.forecast.modelName} (${input.forecast.confidence} confidence, backtest WAPE ${pct(input.forecast.wape)}), expected ${pct(input.forecast.expectedChangePct)} vs the prior equivalent period.`
    );
  }

  return { mode: "mock", summary: lines.join("\n"), disclaimer: DISCLAIMER };
}

export const aiMode = (): AiMode => {
  const m = process.env.AI_MODE;
  return m === "mock" || m === "anthropic" ? m : "disabled";
};
export const hasAnthropicKey = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Anthropic narrative — Claude receives only the structured JSON and strict rules. */
async function explainAnalyticsAnthropic(input: ExplanationInput): Promise<Explanation> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANALYTICS_EXPLAINER_MODEL ?? "claude-sonnet-5";

  const system = [
    "You are an advertising-analytics explainer. You are given ONLY pre-computed, deterministic results as JSON.",
    "Rules you must follow exactly:",
    "- Do NOT recompute, estimate, or invent any number. Use only numbers present in the input.",
    "- Do NOT claim causation; correlations and drivers are associations only.",
    "- Do NOT present the forecast as guaranteed; it is an estimate with uncertainty.",
    "- Be concise (a short paragraph plus a few bullets). Plain English for an account manager.",
    "- End by noting the single most useful thing to investigate next.",
  ].join("\n");

  const msg = await client.messages.create({
    model,
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: `Structured results:\n${JSON.stringify(input, null, 2)}` }],
  });

  const summary = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  return { mode: "anthropic", summary, disclaimer: DISCLAIMER };
}

/** Dispatch on AI_MODE. Throws AiUnavailableError when disabled or the key is missing. */
export async function explainAnalytics(input: ExplanationInput): Promise<Explanation> {
  const mode = aiMode();
  if (mode === "disabled") throw new AiUnavailableError("AI is not configured. Set AI_MODE=mock or AI_MODE=anthropic.");
  if (mode === "mock") return explainAnalyticsMock(input);
  if (!hasAnthropicKey()) throw new AiUnavailableError("AI_MODE=anthropic requires ANTHROPIC_API_KEY.");
  return explainAnalyticsAnthropic(input);
}
