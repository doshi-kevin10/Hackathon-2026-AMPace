import { NextResponse } from "next/server";
import { apiError, previewWorkbook } from "@/lib/api";
import { databricksConfigured, DatabricksError } from "@/lib/databricks/client";
import { syncWorkbookToDatabricks } from "@/lib/databricks/sync";
import { ParsedWorkbookSchema } from "@/lib/schemas/workbook";
import { loadParsed, saveParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

/** Push all eligible tables (canonical ad-metric columns only) to the dev schema. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workbookId: string }> }
) {
  const { workbookId } = await params;
  if (!databricksConfigured()) {
    return apiError(
      "NOT_CONFIGURED",
      "Databricks is not configured — set DATABRICKS_HOST and DATABRICKS_TOKEN",
      503
    );
  }
  const parsed = await loadParsed(workbookId).catch(() => null);
  if (!parsed) return apiError("NOT_FOUND", "Workbook not found (uploads expire after 24h)", 404);

  try {
    const results = await syncWorkbookToDatabricks(parsed);
    await saveParsed(workbookId, parsed);
    return NextResponse.json({
      results,
      workbook: ParsedWorkbookSchema.parse(previewWorkbook(parsed)),
    });
  } catch (err) {
    if (err instanceof DatabricksError) return apiError(err.code, err.message, 502);
    return apiError("SYNC_FAILED", "Databricks sync failed", 500);
  }
}
