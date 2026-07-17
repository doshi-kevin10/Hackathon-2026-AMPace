/**
 * Densify a daily history into a regular, gap-free, finite numeric series so
 * the forecasting models see evenly-spaced data. Interior gaps (missing
 * calendar dates or null values) are linearly interpolated; leading/trailing
 * gaps are nearest-value filled. The count of imputed points is reported so
 * confidence/quality can account for it.
 */
import type { HistoryPoint } from "./types";

const MS_PER_DAY = 86_400_000;
const asUtc = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface DenseSeries {
  dates: string[];
  values: number[];
  imputed: number;
}

export function densify(history: HistoryPoint[]): DenseSeries {
  const known = new Map<string, number>();
  for (const h of history) if (h.value != null && Number.isFinite(h.value)) known.set(h.date.slice(0, 10), h.value);
  if (known.size === 0) return { dates: [], values: [], imputed: 0 };

  // Span the full provided date range (including dates that carried null values).
  const allDates = history.map((h) => h.date.slice(0, 10)).sort();
  const start = asUtc(allDates[0]);
  const end = asUtc(allDates[allDates.length - 1]);

  const dates: string[] = [];
  const raw: (number | null)[] = [];
  for (let t = start; t <= end; t += MS_PER_DAY) {
    const iso = isoOf(t);
    dates.push(iso);
    raw.push(known.has(iso) ? known.get(iso)! : null);
  }

  const values = raw.slice() as number[];
  let imputed = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) continue;
    imputed++;
    // find previous and next known indices
    let prev = i - 1;
    while (prev >= 0 && raw[prev] == null) prev--;
    let next = i + 1;
    while (next < raw.length && raw[next] == null) next++;
    if (prev >= 0 && next < raw.length) {
      const span = next - prev;
      values[i] = raw[prev]! + ((raw[next]! - raw[prev]!) * (i - prev)) / span; // linear
    } else if (prev >= 0) {
      values[i] = raw[prev]!; // forward fill (trailing gap)
    } else {
      values[i] = raw[next]!; // back fill (leading gap)
    }
  }

  return { dates, values, imputed };
}
