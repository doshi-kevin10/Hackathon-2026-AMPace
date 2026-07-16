import { apiError } from "@/lib/api";
import { loadParsed } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

/** Full normalized workbook (no preview truncation) as a JSON download. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workbookId: string }> }
) {
  const { workbookId } = await params;
  const parsed = await loadParsed(workbookId).catch(() => null);
  if (!parsed) return apiError("NOT_FOUND", "Workbook not found (uploads expire after 24h)", 404);

  const base = parsed.filename.replace(/\.(xlsx|xls)$/i, "");
  return new Response(JSON.stringify(parsed, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${base}.parsed.json"`,
    },
  });
}
