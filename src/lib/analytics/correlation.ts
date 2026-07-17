/**
 * Correlation explorer between two aligned series. Pearson (linear) and
 * Spearman (rank/monotonic), lagged correlations over a limited range, and a
 * hard sample-size guard — no coefficient is reported when there are too few
 * valid paired observations. Correlation is never presented as causation; the
 * result always carries that caveat.
 */

const CAUSATION_CAVEAT =
  "Correlation does not imply causation — a relationship here may be coincidental or driven by a third factor.";

/** Pearson r over paired finite values; null if < minSamples or a series has zero variance. */
export function pearson(xs: (number | null)[], ys: (number | null)[], minSamples = 8): number | null {
  const px: number[] = [];
  const py: number[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const a = xs[i];
    const b = ys[i];
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      px.push(a);
      py.push(b);
    }
  }
  if (px.length < minSamples) return null;
  const mx = px.reduce((s, v) => s + v, 0) / px.length;
  const my = py.reduce((s, v) => s + v, 0) / py.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < px.length; i++) {
    const dx = px[i] - mx;
    const dy = py[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom === 0 ? null : sxy / denom;
}

/** Average-rank transform (ties share the mean rank). */
function ranks(values: number[]): number[] {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array(values.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k].i] = avgRank;
    i = j + 1;
  }
  return out;
}

export function spearman(xs: (number | null)[], ys: (number | null)[], minSamples = 8): number | null {
  const px: number[] = [];
  const py: number[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const a = xs[i];
    const b = ys[i];
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      px.push(a);
      py.push(b);
    }
  }
  if (px.length < minSamples) return null;
  return pearson(ranks(px), ranks(py), minSamples);
}

export interface LagCorrelation {
  lag: number;
  r: number | null;
  n: number;
}

/** Correlate xs[i] with ys[i+lag]; positive lag means xs leads ys. */
export function correlateAtLag(xs: (number | null)[], ys: (number | null)[], lag: number, minSamples = 8): LagCorrelation {
  const ax: (number | null)[] = [];
  const ay: (number | null)[] = [];
  for (let i = 0; i < xs.length; i++) {
    const j = i + lag;
    if (j >= 0 && j < ys.length) {
      ax.push(xs[i]);
      ay.push(ys[j]);
    }
  }
  const n = ax.filter((v, k) => v != null && ay[k] != null).length;
  return { lag, r: pearson(ax, ay, minSamples), n };
}

export interface CorrelationResult {
  n: number;
  pearson: number | null;
  spearman: number | null;
  lagged: LagCorrelation[];
  bestLag: { lag: number; r: number } | null;
  sufficient: boolean;
  warning: string;
}

export function analyzeCorrelation(
  xs: (number | null)[],
  ys: (number | null)[],
  opts: { minSamples?: number; maxLag?: number } = {}
): CorrelationResult {
  const { minSamples = 8, maxLag = 14 } = opts;
  const n = Math.min(xs.length, ys.length);
  let paired = 0;
  for (let i = 0; i < n; i++) if (xs[i] != null && ys[i] != null) paired++;

  const sufficient = paired >= minSamples;
  const lagged: LagCorrelation[] = [];
  let bestLag: { lag: number; r: number } | null = null;
  if (sufficient) {
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      const lc = correlateAtLag(xs, ys, lag, minSamples);
      lagged.push(lc);
      if (lc.r != null && (bestLag == null || Math.abs(lc.r) > Math.abs(bestLag.r))) bestLag = { lag, r: lc.r };
    }
  }

  return {
    n: paired,
    pearson: sufficient ? pearson(xs, ys, minSamples) : null,
    spearman: sufficient ? spearman(xs, ys, minSamples) : null,
    lagged,
    bestLag,
    sufficient,
    warning: sufficient ? CAUSATION_CAVEAT : `Not enough paired observations (${paired} < ${minSamples}) to report a reliable correlation.`,
  };
}
