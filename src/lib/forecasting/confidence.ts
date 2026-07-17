/**
 * Deterministic forecast-confidence classification. A weighted blend of five
 * signals — data quantity, data quality, backtest accuracy, interval precision,
 * and cross-window stability — banded into low/medium/high. Constants are here
 * and unit-tested. Confidence is NEVER assigned by an LLM.
 */
import type { Confidence } from "./types";

export interface ConfidenceInput {
  observations: number;
  minObservations: number;
  dataQualityScore: number; // 0..100
  wape: number | null; // backtest WAPE
  meanRelativeIntervalWidth: number | null; // mean(halfWidth / |predicted|)
  windowStability: number | null; // 0..1, higher = model ranked consistently across windows
}

export interface ConfidenceResult {
  score: number;
  label: Confidence;
  components: { quantity: number; quality: number; accuracy: number; precision: number; stability: number };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const WEIGHTS = { quantity: 0.2, quality: 0.2, accuracy: 0.3, precision: 0.15, stability: 0.15 };
const WAPE_CAP = 0.5; // WAPE ≥ this → zero accuracy credit
const WIDTH_CAP = 1.0; // relative half-width ≥ this → zero precision credit

export function classifyConfidence(input: ConfidenceInput): ConfidenceResult {
  const quantity = clamp01(input.observations / (2 * Math.max(1, input.minObservations)));
  const quality = clamp01(input.dataQualityScore / 100);
  const accuracy = input.wape == null ? 0.3 : clamp01(1 - input.wape / WAPE_CAP);
  const precision = input.meanRelativeIntervalWidth == null ? 0.4 : clamp01(1 - input.meanRelativeIntervalWidth / WIDTH_CAP);
  const stability = input.windowStability == null ? 0.5 : clamp01(input.windowStability);

  const score =
    WEIGHTS.quantity * quantity +
    WEIGHTS.quality * quality +
    WEIGHTS.accuracy * accuracy +
    WEIGHTS.precision * precision +
    WEIGHTS.stability * stability;

  const label: Confidence = score >= 0.66 ? "high" : score >= 0.4 ? "medium" : "low";
  return { score, label, components: { quantity, quality, accuracy, precision, stability } };
}
