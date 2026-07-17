import { NextResponse } from "next/server";
import { authorizeCompany, parseBody } from "@/lib/analytics/route-helpers";
import { ForecastRequestSchema } from "@/lib/analytics/request-schemas";
import { DatabricksError } from "@/lib/databricks/client";
import { getOrCreateForecast } from "@/lib/forecasting/service";

export const runtime = "nodejs";

/** Create-or-return a cached forecast for one metric+horizon. Persists the run for later evaluation. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const auth = await authorizeCompany(name);
  if (!auth.ok) return auth.response;

  const body = await parseBody(req, ForecastRequestSchema);
  if (!body.ok) return body.response;

  try {
    const result = await getOrCreateForecast(name, body.data.metric, body.data.horizonDays, { refresh: body.data.refresh });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not compute forecast";
    return NextResponse.json({ error: { code: "FORECAST_FAILED", message } }, { status: 502 });
  }
}
