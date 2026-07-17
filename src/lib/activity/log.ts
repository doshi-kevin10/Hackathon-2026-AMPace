"use client";

/**
 * Local activity log for the data tab. Records edits the user makes to the
 * *local* view (added rows, edited cells, calc columns, downloads) — the
 * Databricks source is never touched, so this is the only record of what
 * changed. Stored in localStorage and broadcast to the top-bar feed via a
 * window event, so the header and the grid stay in sync without shared state.
 */

export type ActivityKind =
  | "add-row"
  | "delete-row"
  | "edit-cell"
  | "add-column"
  | "delete-column"
  | "download"
  | "data-update"; // Databricks-side row growth (e.g. the live feeder)

export interface ActivityEntry {
  id: string;
  /** Dataset slug the change belongs to. */
  dataset: string;
  /** Human label for the dataset (e.g. "Nike"). */
  label: string;
  /** Where clicking the entry navigates. */
  href: string;
  kind: ActivityKind;
  message: string;
  /** ISO timestamp. */
  at: string;
}

const KEY = "ampace:activity";
const SEEN_KEY = "ampace:activity-seen";
const EVENT = "ampace:activity";
const CAP = 100;

export const getActivity = (): ActivityEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ActivityEntry[];
  } catch {
    return [];
  }
};

export const logActivity = (entry: Omit<ActivityEntry, "id" | "at">): void => {
  if (typeof window === "undefined") return;
  const full: ActivityEntry = { ...entry, id: crypto.randomUUID(), at: new Date().toISOString() };
  const next = [full, ...getActivity()].slice(0, CAP);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
};

export const clearActivity = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
};

/** Timestamp the feed was last opened, used for the unread badge. */
export const getLastSeen = (): number => {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(SEEN_KEY) ?? 0);
};

export const markSeen = (): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_KEY, String(Date.now()));
  window.dispatchEvent(new Event(EVENT));
};

/** Subscribe to changes (same tab via custom event, other tabs via storage). */
export const subscribeActivity = (cb: () => void): (() => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Compact relative time, e.g. "just now", "5m ago", "2h ago", "Jul 3". */
export const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, (Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  const days = Math.round(secs / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
};
