import { NextResponse } from "next/server";
import { authorizeCompany, parseBody } from "@/lib/analytics/route-helpers";
import { CorrelationRequestSchema } from "@/lib/analytics/request-schemas";
import { getCorrelation } from "@/lib/analytics/service";
import { DatabricksError } from "@/lib/databricks/client";

export const runtime = "nodejs";

/** Correlation explorer between two metrics (Pearson/Spearman/lagged) with a causation caveat. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const auth = await authorizeCompany(name);
  if (!auth.ok) return auth.response;

  const body = await parseBody(req, CorrelationRequestSchema);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json(await getCorrelation(name, body.data));
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not compute correlation";
    return NextResponse.json({ error: { code: "CORRELATION_FAILED", message } }, { status: 502 });
  }
}
