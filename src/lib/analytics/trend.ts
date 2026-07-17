/**
 * Deterministic trend analysis over a numeric series. Uses ordinary
 * least-squares on `(index, value)` pairs (nulls skipped, index preserved).
 * Tiny fluctuations are labelled `flat` via a documented, configurable
 * threshold so noise is never dressed up as a trend.
 */
import { finite, rollingMean } from "./statistics";

export interface Regression {
  slope: number | null;
  intercept: number | null;
}

export interface TrendResult {
  slope: number | null; // per-step
  intercept: number | null;
  rSquared: number | null; // trend strength 0..1
  percentChange: number | null; // (fittedEnd - fittedStart) / |fittedStart|
  direction: "increasing" | "decreasing" | "flat";
  shortMA: number | null;
  longMA: number | null;
  acceleration: "accelerating" | "decelerating" | "steady" | null;
  observations: number;
}

export interface TrendOptions {
  /** Total relative change (vs mean level) below which the trend is `flat`. Default 0.05 (5%). */
  flatThreshold?: number;
  shortWindow?: number; // default 7
  longWindow?: number; // default 28
  /** Relative change in local slope magnitude to count as accel/decel. Default 0.1. */
  accelThreshold?: number;
}

type Pt = { x: number; y: number };

const points = (values: (number | null)[]): Pt[] => {
  const out: Pt[] = [];
  values.forEach((y, x) => {
    if (y != null && Number.isFinite(y)) out.push({ x, y });
  });
  return out;
};

function regress(pts: Pt[]): Regression {
  if (pts.length < 2) return { slope: null, intercept: null };
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: null, intercept: null };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export function linearRegression(values: (number | null)[]): Regression {
  return regress(points(values));
}

function slopeOf(values: (number | null)[]): number | null {
  return regress(points(values)).slope;
}

export function analyzeTrend(values: (number | null)[], opts: TrendOptions = {}): TrendResult {
  const { flatThreshold = 0.05, shortWindow = 7, longWindow = 28, accelThreshold = 0.1 } = opts;
  const pts = points(values);
  const { slope, intercept } = regress(pts);
  const observations = pts.length;

  let rSquared: number | null = null;
  let percentChange: number | null = null;
  let direction: TrendResult["direction"] = "flat";

  if (slope != null && intercept != null && pts.length >= 2) {
    const ys = pts.map((p) => p.y);
    const my = ys.reduce((s, y) => s + y, 0) / ys.length;
    const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
    const ssRes = pts.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
    rSquared = ssTot === 0 ? null : Math.max(0, 1 - ssRes / ssTot);

    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    const fittedStart = intercept + slope * firstX;
    const fittedEnd = intercept + slope * lastX;
    const totalChange = fittedEnd - fittedStart;
    percentChange = fittedStart !== 0 ? totalChange / Math.abs(fittedStart) : null;

    // Classify by total change relative to the mean level (robust near zero start).
    const relative = my !== 0 ? totalChange / Math.abs(my) : totalChange;
    if (Math.abs(relative) < flatThreshold) direction = "flat";
    else direction = relative > 0 ? "increasing" : "decreasing";
  }

  const lastNonNull = (xs: (number | null)[]): number | null => {
    for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) return xs[i];
    return null;
  };
  const shortMA = lastNonNull(rollingMean(values, shortWindow));
  const longMA = lastNonNull(rollingMean(values, longWindow));

  // Acceleration: magnitude of the local slope over the recent half vs the older half.
  let acceleration: TrendResult["acceleration"] = null;
  const f = finite(values);
  if (f.length >= 4) {
    const mid = Math.floor(f.length / 2);
    const older = slopeOf(f.slice(0, mid));
    const recent = slopeOf(f.slice(mid));
    if (older != null && recent != null) {
      const rel = (Math.abs(recent) - Math.abs(older)) / (Math.abs(older) || 1);
      acceleration = rel > accelThreshold ? "accelerating" : rel < -accelThreshold ? "decelerating" : "steady";
    }
  }

  return { slope, intercept, rSquared, percentChange, direction, shortMA, longMA, acceleration, observations };
}
