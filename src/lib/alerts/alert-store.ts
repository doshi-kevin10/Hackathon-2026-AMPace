import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.EXCEL_DATA_DIR ?? path.join(process.cwd(), ".data", "alerts");

/** Dataset names are already allowlisted (isValidDatasetName) before reaching here — this is defense in depth against the value being used as a path segment. */
const SAFE_NAME = /^[a-z0-9_]+$/;

const filePath = (datasetName: string): string => {
  if (!SAFE_NAME.test(datasetName)) throw new Error(`Invalid dataset name: ${datasetName}`);
  return path.join(DATA_DIR, `${datasetName}.json`);
};

async function loadAlerted(datasetName: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(filePath(datasetName), "utf8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Filters `keys` down to the ones not already alerted for this dataset, and
 * persists the full set so the same anomaly is never Slacked twice across
 * poll cycles (or server restarts).
 */
export async function claimNewAlerts(datasetName: string, keys: string[]): Promise<string[]> {
  const alerted = await loadAlerted(datasetName);
  const fresh = keys.filter((k) => !alerted.has(k));
  if (fresh.length > 0) {
    for (const k of fresh) alerted.add(k);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath(datasetName), JSON.stringify([...alerted]));
  }
  return fresh;
}
