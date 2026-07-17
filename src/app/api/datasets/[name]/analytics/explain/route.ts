import { NextResponse } from "next/server";
import { AiUnavailableError, buildExplanationInput, explainAnalytics, type ForecastFactoid } from "@/lib/analytics/ai-explainer";
import { ExplainRequestSchema } from "@/lib/analytics/request-schemas";
import { authorizeCompany, parseBody } from "@/lib/analytics/route-helpers";
import { getAnalytics } from "@/lib/analytics/service";
import { DatabricksError } from "@/lib/databricks/client";
import { getOrCreateForecast } from "@/lib/forecasting/service";

export const runtime = "nodejs";

/**
 * Optional AI narrative. Recomputes the deterministic bundle SERVER-side and
 * feeds the AI only those structured numbers — never client-supplied values or
 * SQL. Returns 503 when AI is not configured (the app stays usable without it).
 */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const auth = await authorizeCompany(name);
  if (!auth.ok) return auth.response;

  const body = await parseBody(req, ExplainRequestSchema);
  if (!body.ok) return body.response;

  try {
    const bundle = await getAnalytics(name, body.data.analytics);

    let factoid: ForecastFactoid | undefined;
    if (body.data.forecast) {
      const fc = await getOrCreateForecast(name, body.data.forecast.metric, body.data.forecast.horizonDays);
      if (fc.status === "ok" && fc.result) {
        factoid = {
          metric: fc.result.metric,
          horizonDays: fc.result.horizonDays,
          modelName: fc.result.modelName,
          confidence: fc.result.confidence,
          wape: fc.result.backtestMetrics.wape,
          expectedChangePct: null,
        };
      }
    }

    const explanation = await explainAnalytics(buildExplanationInput(bundle, factoid));
    return NextResponse.json(explanation);
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: { code: "AI_NOT_CONFIGURED", message: err.message } }, { status: 503 });
    }
    const message = err instanceof DatabricksError ? err.message : "Could not generate explanation";
    return NextResponse.json({ error: { code: "EXPLAIN_FAILED", message } }, { status: 502 });
  }
}
