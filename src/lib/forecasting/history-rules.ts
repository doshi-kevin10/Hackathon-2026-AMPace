/**
 * Minimum-history rules per forecast horizon. Explicit and env-configurable —
 * a horizon is only offered when enough usable daily observations exist, so we
 * never silently forecast far ahead from too little data.
 */
const envInt = (key: string, fallback: number): number => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export interface HistoryRule {
  horizon: number;
  minObservations: number;
}

export const HISTORY_RULES: HistoryRule[] = [
  { horizon: 7, minObservations: envInt("FORECAST_MIN_OBS_7", 42) },
  { horizon: 14, minObservations: envInt("FORECAST_MIN_OBS_14", 60) },
  { horizon: 30, minObservations: envInt("FORECAST_MIN_OBS_30", 120) },
];

export const SUPPORTED_HORIZONS: number[] = HISTORY_RULES.map((r) => r.horizon);

/** Min observations for a horizon (nearest rule ≥ horizon, else the largest rule). */
export function minObservationsFor(horizon: number): number {
  const exact = HISTORY_RULES.find((r) => r.horizon === horizon);
  if (exact) return exact.minObservations;
  const ge = HISTORY_RULES.filter((r) => r.horizon >= horizon).sort((a, b) => a.horizon - b.horizon)[0];
  return (ge ?? HISTORY_RULES[HISTORY_RULES.length - 1]).minObservations;
}

/** Horizons whose min-observation requirement is satisfied by `observations`. */
export const allowedHorizons = (observations: number): number[] =>
  HISTORY_RULES.filter((r) => observations >= r.minObservations).map((r) => r.horizon);

export const isHorizonSupported = (horizon: number, observations: number): boolean =>
  observations >= minObservationsFor(horizon);
