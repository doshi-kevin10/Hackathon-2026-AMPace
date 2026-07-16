import { promises as fs } from "node:fs";
import path from "node:path";
import type { Goal } from "@/lib/schemas/goal";

/**
 * Per-advertiser goal (ROAS or CPA target). No database in this phase — same
 * lightweight local-JSON pattern as the alert store, keyed by dataset name
 * (which is already allowlisted by isValidDatasetName before reaching here).
 */
const DATA_DIR = process.env.EXCEL_DATA_DIR ?? path.join(process.cwd(), ".data", "goals");
const SAFE_NAME = /^[a-z0-9_]+$/;

const filePath = (datasetName: string): string => {
  if (!SAFE_NAME.test(datasetName)) throw new Error(`Invalid dataset name: ${datasetName}`);
  return path.join(DATA_DIR, `${datasetName}.json`);
};

export async function getGoal(datasetName: string): Promise<Goal | null> {
  try {
    const raw = await fs.readFile(filePath(datasetName), "utf8");
    return JSON.parse(raw) as Goal;
  } catch {
    return null;
  }
}

export async function setGoal(datasetName: string, goal: Goal): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath(datasetName), JSON.stringify(goal));
}

/** All goals at once, keyed by dataset name — used to build cross-account chat context. */
export async function getAllGoals(): Promise<Map<string, Goal>> {
  const out = new Map<string, Goal>();
  try {
    const files = await fs.readdir(DATA_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -".json".length);
      const goal = await getGoal(name);
      if (goal) out.set(name, goal);
    }
  } catch {
    // No goals directory yet — nothing set.
  }
  return out;
}
