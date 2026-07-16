import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { parseWorkbook, WorkbookParseError } from "@/lib/excel/parse-workbook";
import { UploadResponseSchema } from "@/lib/schemas/workbook";
import { saveWorkbook } from "@/lib/storage/workbooks";

export const runtime = "nodejs";

/** Developer-only sample loader. Names are a fixed allowlist — never user paths. */
const SAMPLES: Record<string, string> = {
  "ad-performance": "Ad performance report",
  "simple-sales": "Simple sales report",
  "finance-multi-sheet": "Multi-sheet finance workbook",
  "two-tables-one-sheet": "Two tables on one sheet",
  "messy-report": "Messy report (titles, blanks, hidden rows)",
  "merged-cells": "Merged cells & two-row header",
  formulas: "Formulas with cached values",
  "duplicate-headers": "Duplicate headers",
};

const enabled = () =>
  process.env.NODE_ENV !== "production" || process.env.EXCEL_ENABLE_SAMPLES === "1";

const fixturePath = (name: string) => path.join(process.cwd(), "fixtures", `${name}.xlsx`);

export async function GET() {
  if (!enabled()) return apiError("FORBIDDEN", "Samples are disabled in production", 403);
  const samples = await Promise.all(
    Object.entries(SAMPLES).map(async ([name, label]) => ({
      name,
      label,
      available: await fs.access(fixturePath(name)).then(() => true, () => false),
    }))
  );
  return NextResponse.json({ samples });
}

export async function POST(req: Request) {
  if (!enabled()) return apiError("FORBIDDEN", "Samples are disabled in production", 403);

  const body = z.object({ name: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success || !(body.data.name in SAMPLES)) {
    return apiError("INVALID_REQUEST", "Unknown sample name", 400);
  }

  const filename = `${body.data.name}.xlsx`;
  let buf: Buffer;
  try {
    buf = await fs.readFile(fixturePath(body.data.name));
  } catch {
    return apiError("NOT_FOUND", "Fixture missing — run `npm run fixtures` first", 404);
  }

  try {
    const id = crypto.randomUUID();
    const parsed = parseWorkbook(buf, filename, id);
    await saveWorkbook(id, filename, buf, parsed);
    return NextResponse.json(
      UploadResponseSchema.parse({
        workbookId: id,
        filename,
        sheetCount: parsed.sheets.length,
        tableCount: parsed.sheets.reduce((n, s) => n + s.tables.length, 0),
        warningCount: parsed.sheets.reduce(
          (n, s) => n + s.warnings.length + s.tables.reduce((m, t) => m + t.warnings.length, 0),
          0
        ),
      }),
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof WorkbookParseError) return apiError(err.code, err.message, 400);
    return apiError("PARSE_FAILED", "The sample could not be parsed", 500);
  }
}
