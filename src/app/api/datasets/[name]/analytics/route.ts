import { NextResponse } from "next/server";
import { authorizeCompany, parseBody } from "@/lib/analytics/route-helpers";
import { AnalyticsRequestSchema } from "@/lib/analytics/request-schemas";
import { getAnalytics } from "@/lib/analytics/service";
import { DatabricksError } from "@/lib/databricks/client";

export const runtime = "nodejs";

/** Deterministic analytics bundle (series, comparison, baseline, trend, anomalies, drivers, quality). */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const auth = await authorizeCompany(name);
  if (!auth.ok) return auth.response;

  const body = await parseBody(req, AnalyticsRequestSchema);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json(await getAnalytics(name, body.data));
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not compute analytics";
    return NextResponse.json({ error: { code: "ANALYTICS_FAILED", message } }, { status: 502 });
  }
}
