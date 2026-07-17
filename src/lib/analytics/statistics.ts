/**
 * Small, dependency-free descriptive statistics over `(number|null)[]`. Null /
 * non-finite entries are treated as missing everywhere. Rolling helpers are
 * trailing windows aligned to the input (null until the window is satisfied),
 * so index `i` reflects the window ending at `i`.
 */

export const finite = (xs: (number | null | undefined)[]): number[] =>
  xs.filter((x): x is number => x != null && Number.isFinite(x));

export function mean(xs: (number | null)[]): number | null {
  const f = finite(xs);
  return f.length ? f.reduce((s, x) => s + x, 0) / f.length : null;
}

export function median(xs: (number | null)[]): number | null {
  const f = finite(xs).sort((a, b) => a - b);
  if (!f.length) return null;
  const mid = Math.floor(f.length / 2);
  return f.length % 2 ? f[mid] : (f[mid - 1] + f[mid]) / 2;
}

export function min(xs: (number | null)[]): number | null {
  const f = finite(xs);
  return f.length ? Math.min(...f) : null;
}

export function max(xs: (number | null)[]): number | null {
  const f = finite(xs);
  return f.length ? Math.max(...f) : null;
}

/** Sample (n-1) standard deviation; null with fewer than 2 finite values. */
export function stddev(xs: (number | null)[]): number | null {
  const f = finite(xs);
  if (f.length < 2) return null;
  const m = f.reduce((s, x) => s + x, 0) / f.length;
  const ss = f.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(ss / (f.length - 1));
}

/** Linear-interpolation percentile (numpy 'linear'); `p` in [0,100]. */
export function percentile(xs: (number | null)[], p: number): number | null {
  const f = finite(xs).sort((a, b) => a - b);
  if (!f.length) return null;
  if (f.length === 1) return f[0];
  const rank = (Math.max(0, Math.min(100, p)) / 100) * (f.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return f[lo];
  return f[lo] + (rank - lo) * (f[hi] - f[lo]);
}

const rolling = (xs: (number | null)[], window: number, agg: (w: (number | null)[]) => number | null): (number | null)[] =>
  xs.map((_, i) => (i + 1 < window ? null : agg(xs.slice(i + 1 - window, i + 1))));

export const rollingMean = (xs: (number | null)[], window: number): (number | null)[] => rolling(xs, window, mean);
export const rollingMedian = (xs: (number | null)[], window: number): (number | null)[] => rolling(xs, window, median);

/** Consecutive percentage changes between finite values. */
export function pctChanges(xs: (number | null)[]): number[] {
  const f = finite(xs);
  const out: number[] = [];
  for (let i = 1; i < f.length; i++) {
    if (f[i - 1] !== 0) out.push((f[i] - f[i - 1]) / f[i - 1]);
  }
  return out;
}

/** Volatility = sample stddev of consecutive percentage changes. */
export const volatility = (xs: (number | null)[]): number | null => stddev(pctChanges(xs));

/** Coefficient of variation = stddev / |mean| (null when mean is 0 or undefined). */
export function coefficientOfVariation(xs: (number | null)[]): number | null {
  const m = mean(xs);
  const sd = stddev(xs);
  if (m == null || sd == null || m === 0) return null;
  return sd / Math.abs(m);
}
