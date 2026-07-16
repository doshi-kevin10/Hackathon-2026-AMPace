import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import type { ParsedWorkbook } from "@/lib/schemas/workbook";

const DATA_DIR = process.env.EXCEL_DATA_DIR ?? path.join(process.cwd(), ".data", "workbooks");

const ID_RE = /^[0-9a-f-]{8,64}$/i;

/** Storage ids are server-generated UUIDs — anything else is rejected so ids can never traverse paths. */
const dirFor = (id: string): string => {
  if (!ID_RE.test(id)) throw new Error(`Invalid workbook id: ${id}`);
  return path.join(DATA_DIR, id);
};

export const sanitizeFilename = (name: string): string =>
  path.basename(name).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "workbook.xlsx";

export async function saveWorkbook(
  id: string,
  originalName: string,
  fileBuf: Buffer,
  parsed: ParsedWorkbook
): Promise<void> {
  const dir = dirFor(id);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(sanitizeFilename(originalName)).toLowerCase() || ".xlsx";
  await fs.writeFile(path.join(dir, `original${ext}`), fileBuf);
  await fs.writeFile(path.join(dir, "workbook.json"), JSON.stringify(parsed));
  void sweepExpired(); // fire-and-forget cleanup of old uploads
}

export async function loadParsed(id: string): Promise<ParsedWorkbook | null> {
  try {
    const raw = await fs.readFile(path.join(dirFor(id), "workbook.json"), "utf8");
    return JSON.parse(raw) as ParsedWorkbook;
  } catch {
    return null;
  }
}

export async function saveParsed(id: string, parsed: ParsedWorkbook): Promise<void> {
  await fs.writeFile(path.join(dirFor(id), "workbook.json"), JSON.stringify(parsed));
}

export async function loadOriginal(id: string): Promise<Buffer | null> {
  try {
    const dir = dirFor(id);
    const entry = (await fs.readdir(dir)).find((f) => f.startsWith("original."));
    return entry ? await fs.readFile(path.join(dir, entry)) : null;
  } catch {
    return null;
  }
}

/** Delete stored workbooks older than the retention window. */
export async function sweepExpired(): Promise<void> {
  try {
    const cutoff = Date.now() - config.retentionHours * 3_600_000;
    for (const entry of await fs.readdir(DATA_DIR)) {
      const dir = path.join(DATA_DIR, entry);
      const stat = await fs.stat(dir).catch(() => null);
      if (stat?.isDirectory() && stat.mtimeMs < cutoff) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  } catch {
    // best-effort cleanup; never fail a request over it
  }
}
