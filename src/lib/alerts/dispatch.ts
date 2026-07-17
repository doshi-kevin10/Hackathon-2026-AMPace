/**
 * Fan the deterministic notification feed out to Slack. This is the single
 * dispatch point for week-over-week moves and data-quality issues; robust
 * anomalies (kind "anomaly") stay in-app only because the per-dataset monitor
 * route already Slacks the richer, news-explained version of the same event.
 */
import { CANONICAL_FIELDS } from "@/lib/metrics/canonical-registry";
import type { Notification } from "@/lib/notifications/watchtower";
import { claimNewAlerts } from "./alert-store";
import { ownerFor } from "./owners";
import { isSlackConfigured, sendSlackAlert, type SlackAlert } from "./slack";

const contextFor = (n: Notification): string =>
  n.kind === "quality" ? "data quality" : n.kind === "change" ? "week over week" : "anomaly";

function toAlert(n: Notification): SlackAlert {
  return {
    severity: n.severity,
    title: n.title,
    detail: n.detail,
    metric: n.metric ? CANONICAL_FIELDS[n.metric].displayName : undefined,
    date: n.date,
    owner: ownerFor(n.company),
    href: n.href,
    context: contextFor(n),
  };
}

/**
 * Send Slack alerts for any feed items not already alerted. Deduped per dataset
 * via alert-store using each notification's period-scoped `alertKey`. Never
 * throws — a Slack failure must not break the notifications endpoint.
 */
export async function dispatchNotificationAlerts(notifications: Notification[]): Promise<void> {
  if (!isSlackConfigured()) return;

  // Anomalies are owned by the monitor route (news-explained); skip here.
  const slackable = notifications.filter((n) => n.kind !== "anomaly");
  if (slackable.length === 0) return;

  const byCompany = new Map<string, Notification[]>();
  for (const n of slackable) {
    const list = byCompany.get(n.company) ?? [];
    list.push(n);
    byCompany.set(n.company, list);
  }

  for (const [company, items] of byCompany) {
    const keyOf = (n: Notification) => n.alertKey ?? n.id;
    const fresh = new Set(await claimNewAlerts(company, items.map(keyOf)));
    for (const n of items) {
      if (fresh.has(keyOf(n))) await sendSlackAlert(toAlert(n));
    }
  }
}
