import type { DatasetBehavior } from "@/lib/activity/behavior";
import type { Dataset } from "@/lib/databricks/analytics";

/**
 * Turns tracked behavior (what the user opens / skips / hasn't revisited) plus
 * light data-freshness signal into neutral, observational nudges. No coaching,
 * no "improve", no score — just "here's something you might want to look at".
 * Pure and deterministic so it's testable and safe to run on every render.
 */

export type SuggestionTone = "new" | "attention" | "info";

export interface Suggestion {
  /** Stable id (per company + kind) so it can be dismissed for the day. */
  id: string;
  tone: SuggestionTone;
  title: string;
  body: string;
  href: string;
  actionLabel: string;
}

const NEGLECT_MIN_OTHER_VIEWS = 1; // only nudge about untouched companies once they've used the app
const BLINDSPOT_MIN_VIEWS = 2;

const toMs = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const dayDiff = (a: string, b: string): number => Math.round((toMs(a) - toMs(b)) / 86_400_000);
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Priority: fresh data first (timely), then untouched, then blind spots. */
const RANK: Record<SuggestionTone, number> = { new: 0, attention: 1, info: 2 };

export function buildSuggestions(
  datasets: Dataset[],
  behavior: Record<string, DatasetBehavior>,
): Suggestion[] {
  const out: Suggestion[] = [];
  const beh = (name: string): DatasetBehavior | undefined => behavior[name];

  const viewed = datasets.filter((d) => beh(d.name)?.lastViewedAt);
  const totalViews = viewed.reduce((n, d) => n + (beh(d.name)?.views ?? 0), 0);
  // Most recently opened company — used as the "you've been focused on X" anchor.
  const hot = [...viewed].sort(
    (a, b) => (beh(b.name)!.lastViewedAt! > beh(a.name)!.lastViewedAt! ? 1 : -1),
  )[0];

  for (const d of datasets) {
    const b = beh(d.name);

    // 1. New data landed since the user last looked (feeder-driven).
    if (b?.lastViewedAt && b.lastSeenLatestDate && d.latestDate && d.latestDate > b.lastSeenLatestDate) {
      const n = dayDiff(d.latestDate, b.lastSeenLatestDate);
      out.push({
        id: `fresh:${d.name}`,
        tone: "new",
        title: `New data in ${d.label}`,
        body: `${plural(n, "new day")} of data since you last opened ${d.label}.`,
        href: `/datasets/${d.name}/analytics`,
        actionLabel: `Open ${d.label}`,
      });
      continue; // don't also nag about the same company below
    }

    // 2. Opened the company repeatedly but never its Analytics.
    if (b && b.views >= BLINDSPOT_MIN_VIEWS && b.analyticsViews === 0) {
      out.push({
        id: `analytics:${d.name}`,
        tone: "info",
        title: `${d.label}'s analytics is unopened`,
        body: `You've opened ${d.label} ${plural(b.views, "time")} but never its Analytics tab.`,
        href: `/datasets/${d.name}/analytics`,
        actionLabel: "See analytics",
      });
      continue;
    }

    // 3. Never opened at all, while the user is actively working elsewhere.
    if (!b?.lastViewedAt && totalViews >= NEGLECT_MIN_OTHER_VIEWS && hot && hot.name !== d.name) {
      out.push({
        id: `neglected:${d.name}`,
        tone: "attention",
        title: `${d.label} hasn't had a look`,
        body: `You've been focused on ${hot.label}; you haven't opened ${d.label} yet.`,
        href: `/datasets/${d.name}`,
        actionLabel: `Open ${d.label}`,
      });
    }
  }

  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}
