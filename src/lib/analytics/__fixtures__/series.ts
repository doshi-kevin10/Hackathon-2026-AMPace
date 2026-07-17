/**
 * Deterministic synthetic daily series for tests. Seeded PRNG (no RNG/clock at
 * import), so every run is identical and expectations are reproducible. Encodes
 * the scenario features the spec asks for:
 *   - stable upward click trend + weekly seasonality + controlled noise
 *   - one injected anomaly spike (spend) at FIXTURE_ANOMALY_DATE
 *   - one missing calendar date (FIXTURE_MISSING_DATE) — a real gap
 *   - a revenue-per-conversion decline segment (revenue decline)
 *   - a spend-increase step segment (budget bump)
 *   - rising CPC and, as a consequence, a ROAS decline
 */
import type { DailyPoint } from "../series";

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIXTURE_START = "2026-01-01";
export const FIXTURE_DAYS = 150;
export const FIXTURE_MISSING_INDEX = 100; // this calendar day is omitted entirely
export const FIXTURE_ANOMALY_INDEX = 50; // spend spikes ~4x here

const MS_PER_DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const FIXTURE_MISSING_DATE = iso(
  new Date(`${FIXTURE_START}T00:00:00Z`).getTime() + FIXTURE_MISSING_INDEX * MS_PER_DAY
);
export const FIXTURE_ANOMALY_DATE = iso(
  new Date(`${FIXTURE_START}T00:00:00Z`).getTime() + FIXTURE_ANOMALY_INDEX * MS_PER_DAY
);

/** Build the fixture series once (pure, deterministic). */
export function syntheticSeries(): DailyPoint[] {
  const rand = mulberry32(42);
  const base = new Date(`${FIXTURE_START}T00:00:00Z`).getTime();
  const points: DailyPoint[] = [];

  for (let t = 0; t < FIXTURE_DAYS; t++) {
    if (t === FIXTURE_MISSING_INDEX) continue; // leave a hole

    const date = iso(base + t * MS_PER_DAY);
    const noise = rand() - 0.5;

    const seasonal = 120 * Math.sin((2 * Math.PI * (t % 7)) / 7);
    let clicks = Math.round(1000 + 4 * t + seasonal + noise * 40);
    if (clicks < 1) clicks = 1;

    const cpc = 1.5 + 0.004 * t; // rising CPC
    let adspend = clicks * cpc;
    if (t >= 110) adspend *= 1.5; // budget bump → spend increase segment
    if (t === FIXTURE_ANOMALY_INDEX) adspend *= 4; // injected anomaly spike

    const cvr = Math.max(0.005, 0.03 - 0.00003 * t);
    const conversions = Math.max(0, Math.round(clicks * cvr));

    const revPerConv = t >= 90 ? Math.max(20, 60 - 0.15 * (t - 90)) : 60; // revenue decline
    const revenue = conversions * revPerConv;

    points.push({
      date,
      total_adspend: Math.round(adspend * 100) / 100,
      clicks,
      revenue: Math.round(revenue * 100) / 100,
      conversions,
      rowCount: 1,
    });
  }
  return points;
}
