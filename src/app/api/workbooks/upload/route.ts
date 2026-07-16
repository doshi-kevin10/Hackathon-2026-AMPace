import { NextResponse } from "next/server";
import { apiError, previewWorkbook } from "@/lib/api";
import { config } from "@/lib/config";
import { parseWorkbook, WorkbookParseError } from "@/lib/excel/parse-workbook";
import { UploadResponseSchema } from "@/lib/schemas/workbook";
import { sanitizeFilename, saveWorkbook } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

const ALLOWED_EXT = /\.(xlsx|xls)$/i;
// Browsers are inconsistent about Excel MIME types; block clearly-wrong ones,
// accept empty/octet-stream, and rely on parse-time validation for the rest.
const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "",
]);

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("INVALID_REQUEST", "Expected multipart/form-data with a 'file' field", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("INVALID_REQUEST", "Missing 'file' field", 400);
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return apiError("UNSUPPORTED_FILE_TYPE", "Only .xlsx and .xls files are supported", 415);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return apiError("UNSUPPORTED_FILE_TYPE", `Unexpected content type: ${file.type}`, 415);
  }
  if (file.size > config.maxFileMb * 1024 * 1024) {
    return apiError("FILE_TOO_LARGE", `File exceeds the ${config.maxFileMb} MB limit`, 413);
  }
  if (file.size === 0) {
    return apiError("EMPTY_WORKBOOK", "The uploaded file is empty", 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const filename = sanitizeFilename(file.name);

  try {
    const parsed = parseWorkbook(buf, filename, id);
    await saveWorkbook(id, filename, buf, parsed);
    const preview = previewWorkbook(parsed);
    return NextResponse.json(
      UploadResponseSchema.parse({
        workbookId: id,
        filename,
        sheetCount: preview.sheets.length,
        tableCount: preview.sheets.reduce((n, s) => n + s.tables.length, 0),
        warningCount:
          preview.warnings.length +
          preview.sheets.reduce(
            (n, s) => n + s.warnings.length + s.tables.reduce((m, t) => m + t.warnings.length, 0),
            0
          ),
      }),
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof WorkbookParseError) {
      const status = err.code === "PASSWORD_PROTECTED" ? 422 : 400;
      return apiError(err.code, err.message, status);
    }
    return apiError("PARSE_FAILED", "The workbook could not be parsed", 500);
  }
}
