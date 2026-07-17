import { NextResponse } from "next/server";
import { authorizeCompany } from "@/lib/analytics/route-helpers";
import { DatabricksError } from "@/lib/databricks/client";
import { getForecastPerformance } from "@/lib/forecasting/service";

export const runtime = "nodejs";

/** Historical forecast accuracy: every stored forecast evaluated against actuals that have arrived. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const auth = await authorizeCompany(name);
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await getForecastPerformance(name));
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not evaluate forecast performance";
    return NextResponse.json({ error: { code: "PERFORMANCE_FAILED", message } }, { status: 502 });
  }
}
