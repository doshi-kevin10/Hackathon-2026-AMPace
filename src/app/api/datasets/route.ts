import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { databricksConfigured, DatabricksError } from "@/lib/databricks/client";
import { listDatasets } from "@/lib/databricks/analytics";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!databricksConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Databricks is not configured" } }, { status: 503 });
  }
  try {
    return NextResponse.json({ datasets: await listDatasets() });
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not list datasets";
    return NextResponse.json({ error: { code: "LIST_FAILED", message } }, { status: 502 });
  }
}
