import { z } from "zod";

/** ROAS: higher is better. CPA: lower is better — direction matters for goal-status coloring. */
export const GOAL_METRICS = ["ROAS", "CPA"] as const;
export const GoalMetricSchema = z.enum(GOAL_METRICS);
export type GoalMetric = z.infer<typeof GoalMetricSchema>;

export const GoalSchema = z.object({
  metric: GoalMetricSchema,
  target: z.number().positive(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalResponseSchema = z.object({
  goal: GoalSchema.nullable(),
});
