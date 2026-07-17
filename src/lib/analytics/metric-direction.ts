/**
 * Presentation semantics for metric changes, in ONE place so the UI never
 * hardcodes "up = good". A change's sentiment depends on the metric's
 * optimisation direction; context metrics (spend, clicks) are never auto-judged.
 */
import type { CanonicalFieldId } from "@/lib/metrics/canonical-registry";

export type Direction = "higher_is_better" | "lower_is_better" | "context";
export type Sentiment = "favorable" | "unfavorable" | "neutral";

export const METRIC_DIRECTION: Record<CanonicalFieldId, Direction> = {
  date: "context",
  day: "context",
  total_adspend: "context", // a spend change is not good/bad without ROAS context
  clicks: "context",
  cpc: "lower_is_better",
  revenue: "higher_is_better",
  conversions: "higher_is_better",
  roas: "higher_is_better",
  cvr: "higher_is_better",
};

/** Default: a change smaller than this fraction is treated as flat/neutral. */
export const DEFAULT_EPSILON = 0.005;

/** Direction for a canonical field id or a display name (incl. the CPA relabel). */
export function directionFor(fieldOrName: CanonicalFieldId | string): Direction {
  if (fieldOrName in METRIC_DIRECTION) return METRIC_DIRECTION[fieldOrName as CanonicalFieldId];
  if (fieldOrName.toLowerCase() === "cpa") return "lower_is_better";
  return "context";
}

/**
 * Is a signed fractional change favorable, unfavorable, or neutral for this
 * metric? Changes within `epsilon` are neutral regardless of sign.
 */
export function sentimentFor(
  fieldOrName: CanonicalFieldId | string,
  changeFraction: number | null,
  epsilon: number = DEFAULT_EPSILON
): Sentiment {
  if (changeFraction == null || !Number.isFinite(changeFraction)) return "neutral";
  if (Math.abs(changeFraction) < epsilon) return "neutral";
  const dir = directionFor(fieldOrName);
  if (dir === "context") return "neutral";
  const up = changeFraction > 0;
  if (dir === "higher_is_better") return up ? "favorable" : "unfavorable";
  return up ? "unfavorable" : "favorable"; // lower_is_better
}
