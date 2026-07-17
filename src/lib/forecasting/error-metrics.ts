/**
 * Forecast accuracy metrics over aligned actual/predicted arrays. WAPE is the
 * primary ranking metric (robust around zeros); MAPE is intentionally omitted
 * because it explodes near zero. All return null when undefined (empty input,
 * zero denominators) rather than NaN/Infinity.
 */

const pairs = (a: number[], p: number[]): [number, number][] => {
  const out: [number, number][] = [];
  const n = Math.min(a.length, p.length);
  for (let i = 0; i < n; i++) if (Number.isFinite(a[i]) && Number.isFinite(p[i])) out.push([a[i], p[i]]);
  return out;
};

export function mae(actual: number[], pred: number[]): number | null {
  const ps = pairs(actual, pred);
  if (!ps.length) return null;
  return ps.reduce((s, [a, p]) => s + Math.abs(a - p), 0) / ps.length;
}

export function rmse(actual: number[], pred: number[]): number | null {
  const ps = pairs(actual, pred);
  if (!ps.length) return null;
  return Math.sqrt(ps.reduce((s, [a, p]) => s + (a - p) ** 2, 0) / ps.length);
}

/** Weighted absolute percentage error = Σ|a−p| / Σ|a|. */
export function wape(actual: number[], pred: number[]): number | null {
  const ps = pairs(actual, pred);
  const denom = ps.reduce((s, [a]) => s + Math.abs(a), 0);
  if (!ps.length || denom === 0) return null;
  return ps.reduce((s, [a, p]) => s + Math.abs(a - p), 0) / denom;
}

/** Symmetric MAPE = mean( 2|a−p| / (|a|+|p|) ), range [0,2]. Terms with |a|+|p|=0 contribute 0. */
export function smape(actual: number[], pred: number[]): number | null {
  const ps = pairs(actual, pred);
  if (!ps.length) return null;
  return (
    ps.reduce((s, [a, p]) => {
      const denom = Math.abs(a) + Math.abs(p);
      return s + (denom === 0 ? 0 : (2 * Math.abs(a - p)) / denom);
    }, 0) / ps.length
  );
}

/** MASE = MAE / scale, where scale is the mean absolute naive one-step error on the training set. */
export function mase(actual: number[], pred: number[], scale: number): number | null {
  const m = mae(actual, pred);
  if (m == null || !Number.isFinite(scale) || scale === 0) return null;
  return m / scale;
}

/** Mean absolute one-step naive error of a series — the standard MASE scale. */
export function naiveScale(values: number[]): number {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < values.length; i++) {
    if (Number.isFinite(values[i]) && Number.isFinite(values[i - 1])) {
      sum += Math.abs(values[i] - values[i - 1]);
      n++;
    }
  }
  return n ? sum / n : 0;
}
