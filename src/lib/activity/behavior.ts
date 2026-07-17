"use client";

/**
 * Passive activity tracker. Records *what the user looks at* — which companies
 * they open, whether they open Analytics, when they last visited, and the data
 * freshness they saw at that visit. This is the signal the suggestion engine
 * reads to surface nudges on its own; it is never shown as a "score" and the
 * user is never asked to do anything to populate it.
 *
 * localStorage-only (per browser), broadcast via a window event so the ambient
 * nudge re-evaluates without shared state. Databricks is never touched.
 */

export interface DatasetBehavior {
  /** Times the company was opened (data or analytics). */
  views: number;
  /** Times its Analytics tab was opened. */
  analyticsViews: number;
  /** ISO timestamp of the last visit, or null if never opened. */
  lastViewedAt: string | null;
  /** The dataset's latest data date (YYYY-MM-DD) as of the last visit. */
  lastSeenLatestDate: string | null;
}

interface BehaviorState {
  datasets: Record<string, DatasetBehavior>;
  /** suggestionId → day (YYYY-MM-DD) it was dismissed. */
  dismissed: Record<string, string>;
  /** epoch ms of the last time a nudge was shown (throttle). */
  lastNudgeAt: number;
}

const KEY = "ampulse:behavior";
const EVENT = "ampulse:behavior";

const empty = (): BehaviorState => ({ datasets: {}, dismissed: {}, lastNudgeAt: 0 });

const read = (): BehaviorState => {
  if (typeof window === "undefined") return empty();
  try {
    return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<BehaviorState>) };
  } catch {
    return empty();
  }
};

const write = (s: BehaviorState): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT));
};

const today = (): string => new Date().toISOString().slice(0, 10);

export const getBehavior = (): Record<string, DatasetBehavior> => read().datasets;

/** Record one visit to a company. Called on navigation, once per distinct page. */
export const recordView = (
  name: string,
  opts: { analytics?: boolean; latestDate?: string | null } = {},
): void => {
  const s = read();
  const d: DatasetBehavior =
    s.datasets[name] ?? { views: 0, analyticsViews: 0, lastViewedAt: null, lastSeenLatestDate: null };
  d.views += 1;
  if (opts.analytics) d.analyticsViews += 1;
  d.lastViewedAt = new Date().toISOString();
  if (opts.latestDate) d.lastSeenLatestDate = opts.latestDate;
  s.datasets[name] = d;
  write(s);
};

export const isDismissedToday = (id: string): boolean => read().dismissed[id] === today();

export const dismissSuggestion = (id: string): void => {
  const s = read();
  s.dismissed[id] = today();
  write(s);
};

export const getLastNudgeAt = (): number => read().lastNudgeAt;

export const markNudged = (): void => {
  const s = read();
  s.lastNudgeAt = Date.now();
  write(s);
};

export const subscribeBehavior = (cb: () => void): (() => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
