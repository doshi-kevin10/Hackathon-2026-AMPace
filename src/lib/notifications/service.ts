/**
 * Gather the cross-company notification feed: list accessible companies, pull
 * each daily series, run the deterministic watchtower. Cached briefly so the
 * topbar poll doesn't recompute constantly.
 */
import { dispatchNotificationAlerts } from "@/lib/alerts/dispatch";
import { createAsyncCache } from "@/lib/analytics/cache";
import { getDailySeries } from "@/lib/databricks/history";
import { listDatasets } from "@/lib/databricks/analytics";
import { buildNotifications, qualityNotifications, SEVERITY_RANK, type Notification } from "./watchtower";

const cache = createAsyncCache<Notification[]>({ ttlMs: 60_000 });

export async function getNotifications(): Promise<Notification[]> {
  return cache.get("all", async () => {
    const asOf = new Date().toISOString().slice(0, 10);
    const datasets = await listDatasets();
    const companies = await Promise.all(
      datasets.map(async (d) => ({ name: d.name, label: d.label, series: await getDailySeries(d.name) }))
    );

    const changes = buildNotifications(companies.map((c) => ({ name: c.name, label: c.label, points: c.series.points })));
    const quality = companies.flatMap((c) =>
      qualityNotifications(c.name, c.label, c.series.points, { asOf, duplicateDates: c.series.duplicateDates })
    );
    const feed = [...changes, ...quality].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, 15);

    // Push fresh alerts to Slack (deduped). In the cache factory so it runs at
    // most once per TTL rather than on every cache hit.
    await dispatchNotificationAlerts(feed);
    return feed;
  });
}
