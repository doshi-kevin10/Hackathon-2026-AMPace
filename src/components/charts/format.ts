export const compactNumber = (n: number): string =>
  new Intl.NumberFormat("en", {
    notation: Math.abs(n) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(n);

export const percentFormat = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** "Nice" tick step (1/2/5 × 10^n) covering [min, max] in ~`count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks.length === 0) ticks.push(min, max);
  return ticks;
}
