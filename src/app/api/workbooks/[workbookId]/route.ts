import { NextResponse } from "next/server";
import { apiError, previewWorkbook } from "@/lib/api";
import { ParsedWorkbookSchema } from "@/lib/schemas/workbook";
import { loadParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workbookId: string }> }
) {
  const { workbookId } = await params;
  const parsed = await loadParsed(workbookId).catch(() => null);
  if (!parsed) return apiError("NOT_FOUND", "Workbook not found (uploads expire after 24h)", 404);
  return NextResponse.json(ParsedWorkbookSchema.parse(previewWorkbook(parsed)));
}
