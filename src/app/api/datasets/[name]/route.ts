import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { databricksConfigured, DatabricksError } from "@/lib/databricks/client";
import { getDatasetRows, isValidDatasetName } from "@/lib/databricks/analytics";

export const runtime = "nodejs";

/** Live canonical-metric rows for one dataset. Auth-guarded; name is allowlisted. */
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
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Databricks is not configured" } }, { status: 503 });
  }
  try {
    return NextResponse.json(await getDatasetRows(name));
  } catch (err) {
    const message = err instanceof DatabricksError ? err.message : "Could not load the dataset";
    return NextResponse.json({ error: { code: "LOAD_FAILED", message } }, { status: 502 });
  }
}
