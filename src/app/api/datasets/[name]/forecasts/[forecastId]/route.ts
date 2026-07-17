import { NextResponse } from "next/server";
import { authorizeCompany } from "@/lib/analytics/route-helpers";
import { getStoredForecast } from "@/lib/forecasting/service";

export const runtime = "nodejs";

/** Fetch a previously-generated forecast run by id. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string; forecastId: string }> }) {
  const { name, forecastId } = await params;
  const auth = await authorizeCompany(name);
  if (!auth.ok) return auth.response;

  try {
    const stored = await getStoredForecast(name, forecastId);
    if (!stored) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Forecast not found" } }, { status: 404 });
    return NextResponse.json(stored);
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Forecast not found" } }, { status: 404 });
  }
}
