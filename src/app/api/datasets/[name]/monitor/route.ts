import { NextResponse } from "next/server";
import { claimNewAlerts } from "@/lib/alerts/alert-store";
import { ownerFor } from "@/lib/alerts/owners";
import { isSlackConfigured, sendSlackAlert } from "@/lib/alerts/slack";
import { detectAnomalies } from "@/lib/analytics/anomalies";
import { requireUser } from "@/lib/auth/server";
import { getDatasetRows, isValidDatasetName } from "@/lib/databricks/analytics";
import { databricksConfigured, DatabricksError } from "@/lib/databricks/client";
import { fetchCompanyNews } from "@/lib/news/google-news";
import { analyzeNewsRelevance, isRelevanceEngineConfigured } from "@/lib/news/relevance";
import { MonitorResponseSchema } from "@/lib/schemas/monitor";

export const runtime = "nodejs";

const compactPct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

/** Only Slack-alert the most significant few per poll, so a naturally volatile dataset
 * doesn't fire a burst of alerts the first time it's viewed. */
const MAX_ALERTS_PER_POLL = 5;

/** Real-time news + anomaly monitor for one dataset's company. Polled by the client UI. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { name } = await params;
  if (!isValidDatasetName(name)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown dataset" } }, { status: 404 });
  }
  if (!databricksConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Databricks is not configured" } },
      { status: 503 }
    );
  }

  let company: string;
  let table: Awaited<ReturnType<typeof getDatasetRows>>;
  try {
    // One dataset = one company table, so the dataset's own label is the company name.
    table = await getDatasetRows(name);
    company = table.label;
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not load the dataset";
    return NextResponse.json({ error: { code: "LOAD_FAILED", message } }, { status: 502 });
  }

  const anomalies = detectAnomalies(table);
  const news = await fetchCompanyNews(company);
  // Only ask Claude to explain the anomalies significant enough to alert on —
  // sending every detected anomaly needlessly bloats the generated output.
  const relevance = await analyzeNewsRelevance(company, news, anomalies.slice(0, MAX_ALERTS_PER_POLL));

  const newsView = news.map((n, i) => ({
    ...n,
    relevant: relevance?.headlineFlags.get(i)?.relevant ?? null,
    reason: relevance?.headlineFlags.get(i)?.reason ?? null,
  }));

  const alertKeyFor = (anomalyId: string) => `${name}:${anomalyId}`;
  // detectAnomalies() sorts by |changePct| descending, so this is the top-N by magnitude.
  const alertCandidates = anomalies.slice(0, MAX_ALERTS_PER_POLL);
  const freshKeys = new Set(
    await claimNewAlerts(
      name,
      alertCandidates.map((a) => alertKeyFor(a.id))
    )
  );

  const anomalyViews = [];
  for (const a of anomalies) {
    const found = relevance?.anomalyExplanations.get(a.id) ?? null;
    const isNew = freshKeys.has(alertKeyFor(a.id));
    if (isNew) {
      const arrow = a.direction === "jump" ? "📈" : "📉";
      await sendSlackAlert({
        // A drop is the risky move; size it by magnitude. A jump is informational.
        severity: a.direction === "drop" ? (Math.abs(a.changePct) >= 0.3 ? "critical" : "warning") : "info",
        title: `${company} · ${a.columnName} ${arrow} ${compactPct(a.changePct)} on ${a.date}`,
        detail: found
          ? `Likely cause: *${found.headline?.title ?? "unknown"}* — ${found.explanation}`
          : "No related news found yet.",
        metric: a.columnName,
        date: a.date,
        owner: ownerFor(name),
        href: `/datasets/${name}/analytics`,
        context: "anomaly · news-explained",
        sourceUrl: found?.headline?.link,
        sourceLabel: found?.headline?.source ? `Read: ${found.headline.source}` : "Read the news",
      });
    }
    anomalyViews.push({
      id: a.id,
      columnName: a.columnName,
      date: a.date,
      direction: a.direction,
      value: a.value,
      previousValue: a.previousValue,
      changePct: a.changePct,
      explanation: found?.explanation ?? null,
      sourceHeadline: found?.headline
        ? { title: found.headline.title, link: found.headline.link, source: found.headline.source }
        : null,
      alerted: isNew,
    });
  }

  return NextResponse.json(
    MonitorResponseSchema.parse({
      company,
      aiConfigured: isRelevanceEngineConfigured(),
      slackConfigured: isSlackConfigured(),
      news: newsView,
      anomalies: anomalyViews,
      checkedAt: new Date().toISOString(),
    })
  );
}
