import { NextResponse } from "next/server";
import { apiError, previewWorkbook } from "@/lib/api";
import { applyTablePatch, CorrectionError } from "@/lib/excel/corrections";
import { WorkbookParseError } from "@/lib/excel/parse-workbook";
import { ParsedWorkbookSchema, TablePatchSchema } from "@/lib/schemas/workbook";
import { loadOriginal, loadParsed, saveParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workbookId: string; tableId: string }> }
) {
  const { workbookId, tableId } = await params;

  const body = TablePatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return apiError("INVALID_PATCH", body.error.issues.map((i) => i.message).join("; "), 400);
  }

  const [parsed, original] = await Promise.all([
    loadParsed(workbookId).catch(() => null),
    loadOriginal(workbookId),
  ]);
  if (!parsed || !original) {
    return apiError("NOT_FOUND", "Workbook not found (uploads expire after 24h)", 404);
  }

  try {
    const updated = applyTablePatch(parsed, original, tableId, body.data);
    await saveParsed(workbookId, updated);
    return NextResponse.json(ParsedWorkbookSchema.parse(previewWorkbook(updated)));
  } catch (err) {
    if (err instanceof CorrectionError) {
      const status = err.code === "TABLE_NOT_FOUND" ? 404 : 400;
      return apiError(err.code, err.message, status);
    }
    if (err instanceof WorkbookParseError) return apiError(err.code, err.message, 400);
    return apiError("PATCH_FAILED", "The correction could not be applied", 500);
  }
}
