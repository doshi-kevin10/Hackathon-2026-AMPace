import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { claimNewAlerts } from "@/lib/alerts/alert-store";
import { isSlackConfigured, sendSlackAlert } from "@/lib/alerts/slack";
import { detectAnomalies } from "@/lib/excel/anomalies";
import { fetchCompanyNews } from "@/lib/news/google-news";
import { analyzeNewsRelevance, isRelevanceEngineConfigured } from "@/lib/news/relevance";
import { MonitorResponseSchema } from "@/lib/schemas/monitor";
import { loadParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

const compactPct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

/** Only Slack-alert the most significant few per poll, so a naturally volatile table
 * doesn't fire a burst of alerts the first time it's tracked. */
const MAX_ALERTS_PER_POLL = 5;

/** Real-time news + anomaly monitor for one table's tracked company. Polled by the client UI. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workbookId: string; tableId: string }> }
) {
  const { workbookId, tableId } = await params;
  const parsed = await loadParsed(workbookId).catch(() => null);
  if (!parsed) return apiError("NOT_FOUND", "Workbook not found (uploads expire after 24h)", 404);

  const table = parsed.sheets.flatMap((s) => s.tables).find((t) => t.id === tableId);
  if (!table) return apiError("NOT_FOUND", "Table not found", 404);

  const anomalies = detectAnomalies(table);

  if (!table.company) {
    return NextResponse.json(
      MonitorResponseSchema.parse({
        company: null,
        aiConfigured: isRelevanceEngineConfigured(),
        slackConfigured: isSlackConfigured(),
        news: [],
        anomalies: anomalies.map((a) => ({
          id: a.id,
          columnName: a.columnName,
          date: a.date,
          direction: a.direction,
          value: a.value,
          previousValue: a.previousValue,
          changePct: a.changePct,
          explanation: null,
          sourceHeadline: null,
          alerted: false,
        })),
        checkedAt: new Date().toISOString(),
      })
    );
  }

  const news = await fetchCompanyNews(table.company);
  // Only ask Claude to explain the anomalies significant enough to alert on —
  // sending all of them (a noisy table can detect dozens) needlessly bloats
  // the generated output and turns a ~2s call into a 20s+ one.
  const relevance = await analyzeNewsRelevance(table.company, news, anomalies.slice(0, MAX_ALERTS_PER_POLL));

  const newsView = news.map((n, i) => ({
    ...n,
    relevant: relevance?.headlineFlags.get(i)?.relevant ?? null,
    reason: relevance?.headlineFlags.get(i)?.reason ?? null,
  }));

  const alertKeyFor = (anomalyId: string) => `${tableId}:${anomalyId}`;
  // detectAnomalies() sorts by |changePct| descending, so this is the top-N by magnitude.
  const alertCandidates = anomalies.slice(0, MAX_ALERTS_PER_POLL);
  const freshKeys = new Set(
    await claimNewAlerts(
      workbookId,
      alertCandidates.map((a) => alertKeyFor(a.id))
    )
  );

  const anomalyViews = [];
  for (const a of anomalies) {
    const found = relevance?.anomalyExplanations.get(a.id) ?? null;
    const isNew = freshKeys.has(alertKeyFor(a.id));
    if (isNew) {
      const arrow = a.direction === "jump" ? "📈" : "📉";
      await sendSlackAlert(
        [
          `${arrow} *${table.company}* — ${a.columnName} ${a.direction} of ${compactPct(a.changePct)} on ${a.date}`,
          found
            ? `Likely cause: "${found.headline?.title ?? "unknown"}" — ${found.explanation}${found.headline ? `\n${found.headline.link}` : ""}`
            : "No related news found yet.",
        ].join("\n")
      );
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
      company: table.company,
      aiConfigured: isRelevanceEngineConfigured(),
      slackConfigured: isSlackConfigured(),
      news: newsView,
      anomalies: anomalyViews,
      checkedAt: new Date().toISOString(),
    })
  );
}
