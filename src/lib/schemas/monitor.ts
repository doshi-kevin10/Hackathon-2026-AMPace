import { z } from "zod";

export const NewsItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  publishedAt: z.string(),
  source: z.string().nullable(),
  /** Short excerpt, when the RSS description carried more than a repeated title. */
  snippet: z.string().nullable(),
  /** Best-effort — Google News RSS rarely embeds one. */
  imageUrl: z.string().nullable(),
  /** null when the relevance engine (ANTHROPIC_API_KEY) isn't configured. */
  relevant: z.boolean().nullable(),
  reason: z.string().nullable(),
});
export type NewsItemView = z.infer<typeof NewsItemSchema>;

export const HeadlineRefSchema = z.object({
  title: z.string(),
  link: z.string(),
  source: z.string().nullable(),
});

export const AnomalyViewSchema = z.object({
  id: z.string(),
  columnName: z.string(),
  date: z.string(),
  direction: z.enum(["jump", "drop"]),
  value: z.number(),
  previousValue: z.number(),
  changePct: z.number(),
  explanation: z.string().nullable(),
  sourceHeadline: HeadlineRefSchema.nullable(),
  /** True the first time this anomaly was seen (and Slacked); false on later polls. */
  alerted: z.boolean(),
});
export type AnomalyView = z.infer<typeof AnomalyViewSchema>;

export const MonitorResponseSchema = z.object({
  company: z.string().nullable(),
  aiConfigured: z.boolean(),
  slackConfigured: z.boolean(),
  news: z.array(NewsItemSchema),
  anomalies: z.array(AnomalyViewSchema),
  checkedAt: z.string(),
});
export type MonitorResponse = z.infer<typeof MonitorResponseSchema>;
