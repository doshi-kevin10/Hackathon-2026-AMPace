import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.EXCEL_DATA_DIR ?? path.join(process.cwd(), ".data", "workbooks");

/** Same id shape as workbook storage — server-generated UUIDs only. */
const ID_RE = /^[0-9a-f-]{8,64}$/i;

const filePath = (workbookId: string): string => {
  if (!ID_RE.test(workbookId)) throw new Error(`Invalid workbook id: ${workbookId}`);
  return path.join(DATA_DIR, workbookId, "alerts.json");
};

async function loadAlerted(workbookId: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(filePath(workbookId), "utf8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Filters `keys` down to the ones not already alerted for this workbook, and
 * persists the full set so the same anomaly is never Slacked twice across
 * poll cycles (or server restarts).
 */
export async function claimNewAlerts(workbookId: string, keys: string[]): Promise<string[]> {
  const alerted = await loadAlerted(workbookId);
  const fresh = keys.filter((k) => !alerted.has(k));
  if (fresh.length > 0) {
    for (const k of fresh) alerted.add(k);
    await fs.writeFile(filePath(workbookId), JSON.stringify([...alerted]));
  }
  return fresh;
}
