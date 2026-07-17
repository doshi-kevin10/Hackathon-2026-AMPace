/**
 * Metric observations: current vs comparison, with change math. Pure.
 *
 * Percent-change rules (§14.4):
 *  - comparison null           → percentChange null
 *  - comparison 0 (any current)→ percentChange null (never ±Infinity)
 *  - otherwise                 → (current - comparison) / comparison
 * A missing (null) current value makes both changes null.
 */

export interface MetricObservation {
  currentValue: number | null;
  comparisonValue: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
}

export function observe(current: number | null, comparison: number | null): MetricObservation {
  const absoluteChange = current != null && comparison != null ? current - comparison : null;
  let percentChange: number | null = null;
  if (current != null && comparison != null && comparison !== 0) {
    percentChange = (current - comparison) / comparison;
  }
  return { currentValue: current, comparisonValue: comparison, absoluteChange, percentChange };
}

/** True when a nonzero current is compared against a zero baseline (percentChange is intentionally null here). */
export const isZeroBaselineJump = (obs: MetricObservation): boolean =>
  obs.comparisonValue === 0 && obs.currentValue != null && obs.currentValue !== 0;
