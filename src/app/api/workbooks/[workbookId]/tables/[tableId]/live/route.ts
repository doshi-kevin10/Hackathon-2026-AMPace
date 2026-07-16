import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { databricksConfigured, DatabricksError } from "@/lib/databricks/client";
import { pullLiveTable } from "@/lib/databricks/sync";
import { loadParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

/** Current contents of a synced table, read back from Databricks (UI auto-refresh). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workbookId: string; tableId: string }> }
) {
  const { workbookId, tableId } = await params;
  if (!databricksConfigured()) {
    return apiError("NOT_CONFIGURED", "Databricks is not configured", 503);
  }
  const parsed = await loadParsed(workbookId).catch(() => null);
  const table = parsed?.sheets.flatMap((s) => s.tables).find((t) => t.id === tableId);
  if (!table) return apiError("NOT_FOUND", "Table not found", 404);
  if (!table.databricks) {
    return apiError("NOT_SYNCED", "This table has not been synced to Databricks yet", 409);
  }

  try {
    return NextResponse.json(await pullLiveTable(table.databricks.table));
  } catch (err) {
    if (err instanceof DatabricksError) return apiError(err.code, err.message, 502);
    return apiError("LIVE_FAILED", "Could not read the table from Databricks", 500);
  }
}
