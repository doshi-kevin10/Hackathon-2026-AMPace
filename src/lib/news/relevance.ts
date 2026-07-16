import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Anomaly } from "@/lib/analytics/anomalies";
import type { NewsItem } from "./google-news";

const RelevanceResultSchema = z.object({
  headlineRelevance: z.array(
    z.object({
      index: z.number().int(),
      relevant: z.boolean(),
      reason: z.string(),
    })
  ),
  anomalyExplanations: z.array(
    z.object({
      anomalyId: z.string(),
      /** Index into the headlines list this anomaly is likely explained by, or null if none. */
      headlineIndex: z.number().int().nullable(),
      explanation: z.string(),
    })
  ),
});

export interface HeadlineFlag {
  relevant: boolean;
  reason: string;
}

export interface AnomalyExplanation {
  headline: NewsItem | null;
  explanation: string;
}

export interface RelevanceResult {
  headlineFlags: Map<number, HeadlineFlag>;
  anomalyExplanations: Map<string, AnomalyExplanation>;
}

let client: Anthropic | null = null;
const getClient = (): Anthropic | null => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
};

export const isRelevanceEngineConfigured = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Ask Claude which headlines could plausibly affect the tracked metrics, and
 * whether any headline explains a detected anomaly. Returns null (never
 * throws) when ANTHROPIC_API_KEY isn't configured or the call fails — news
 * and anomalies are still shown, just unflagged/unexplained, in that case.
 */
export async function analyzeNewsRelevance(
  company: string,
  headlines: NewsItem[],
  anomalies: Anomaly[]
): Promise<RelevanceResult | null> {
  const anthropic = getClient();
  if (!anthropic || headlines.length === 0) return null;

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      output_config: { format: zodOutputFormat(RelevanceResultSchema), effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            `You monitor ad-performance data for "${company}".`,
            "",
            "Recent headlines (0-indexed):",
            ...headlines.map(
              (h, i) => `${i}. ${h.title}${h.source ? ` (${h.source})` : ""} — ${h.publishedAt}`
            ),
            "",
            anomalies.length > 0
              ? [
                  "Detected metric anomalies (day-over-day jumps/drops):",
                  ...anomalies.map(
                    (a) =>
                      `- id=${a.id}: ${a.columnName} ${a.direction} of ${(a.changePct * 100).toFixed(0)}% on ${a.date}`
                  ),
                ].join("\n")
              : "No metric anomalies were detected in the current data.",
            "",
            "For each headline, decide whether it plausibly relates to this company's advertising " +
              "performance, marketing, PR, financial results, or operations — something that could " +
              "move ad spend, clicks, conversions, or revenue. Most general news is not relevant.",
            "For each anomaly, if a headline's timing and content plausibly explain it, reference " +
              "that headline's index; otherwise say plainly that no clear cause was found in the " +
              "current headlines.",
          ].join("\n"),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return null;

    const headlineFlags = new Map<number, HeadlineFlag>();
    for (const h of parsed.headlineRelevance) {
      headlineFlags.set(h.index, { relevant: h.relevant, reason: h.reason });
    }
    const anomalyExplanations = new Map<string, AnomalyExplanation>();
    for (const a of parsed.anomalyExplanations) {
      anomalyExplanations.set(a.anomalyId, {
        headline: a.headlineIndex != null ? (headlines[a.headlineIndex] ?? null) : null,
        explanation: a.explanation,
      });
    }
    return { headlineFlags, anomalyExplanations };
  } catch (err) {
    console.error("News relevance analysis failed:", err);
    return null;
  }
}
