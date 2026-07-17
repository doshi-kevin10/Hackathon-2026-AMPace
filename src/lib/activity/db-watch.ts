"use client";

import type { Dataset } from "@/lib/databricks/analytics";
import { logActivity } from "./log";

/**
 * Detects Databricks-side row growth (the live feeder adds rows we didn't make
 * locally) and logs each increase to the activity feed, so server-side updates
 * show up in the notifications bar. The baseline is seeded silently on first
 * sight so a fresh session doesn't dump one entry per company.
 */
const KEY = "ampulse:db-rowcounts";

const read = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
};

export function logDatabricksGrowth(datasets: Dataset[]): void {
  if (typeof window === "undefined") return;
  const seen = read();
  let dirty = false;

  for (const d of datasets) {
    const prev = seen[d.name];
    if (prev != null && d.rowCount > prev) {
      const delta = d.rowCount - prev;
      logActivity({
        dataset: d.name,
        label: d.label,
        href: `/datasets/${d.name}/analytics`,
        kind: "data-update",
        message: `Data updated — ${delta} new row${delta === 1 ? "" : "s"}${d.latestDate ? ` (through ${d.latestDate})` : ""}`,
      });
    }
    if (prev !== d.rowCount) {
      seen[d.name] = d.rowCount;
      dirty = true;
    }
  }

  if (dirty) localStorage.setItem(KEY, JSON.stringify(seen));
}
