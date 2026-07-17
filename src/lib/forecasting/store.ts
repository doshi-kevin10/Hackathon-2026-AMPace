/**
 * Forecast-run persistence — the same lightweight local-JSON pattern as the
 * goal/alert stores (no DB in this phase). Stored under
 * `.data/forecasts/<company>/<id>.json`. Never stores credentials or SQL.
 * The id is a deterministic function of the data version + params, so the same
 * data + request maps to the same file (natural cache/dedup, no duplicate runs).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ForecastResult } from "./types";

const SAFE = /^[a-z0-9_]+$/;
const dataDir = () => process.env.FORECAST_DATA_DIR ?? path.join(process.cwd(), ".data", "forecasts");

const assertSafe = (s: string): string => {
  if (!SAFE.test(s)) throw new Error(`Unsafe name: ${s}`);
  return s;
};

const sanitize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export interface StoredForecast {
  id: string;
  company: string;
  metric: string;
  horizonDays: number;
  /** latestDate + observation count — bumping this means new data → recompute. */
  dataVersion: string;
  result: ForecastResult;
  createdAt: string;
}

/** Deterministic, filename-safe id: same data + params → same id. */
export function forecastId(metric: string, horizonDays: number, latestDate: string, observations: number): string {
  return sanitize(`${metric}_${horizonDays}d_${latestDate}_${observations}`);
}

const dirFor = (company: string) => path.join(dataDir(), assertSafe(company));

export async function saveForecast(company: string, sf: StoredForecast): Promise<void> {
  const dir = dirFor(company);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${assertSafe(sf.id)}.json`), JSON.stringify(sf));
}

export async function getForecast(company: string, id: string): Promise<StoredForecast | null> {
  try {
    const raw = await fs.readFile(path.join(dirFor(company), `${assertSafe(id)}.json`), "utf8");
    return JSON.parse(raw) as StoredForecast;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    if (err instanceof Error && err.message.startsWith("Unsafe")) throw err;
    return null;
  }
}

export async function listForecasts(company: string): Promise<StoredForecast[]> {
  try {
    const files = await fs.readdir(dirFor(company));
    const out: StoredForecast[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const sf = await getForecast(company, f.slice(0, -".json".length));
      if (sf) out.push(sf);
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}
