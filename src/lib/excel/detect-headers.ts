import type { ParserWarning } from "@/lib/schemas/workbook";
import { classifyCell } from "./infer-types";
import { isEmptyCell, type CellMatrix, type MatrixCell, type Region } from "./types";

export interface HeaderDetection {
  /** Leading rows inside the region treated as a title, absolute indices. */
  titleRows: number[];
  /** Header rows, absolute indices. Empty = headerless table. */
  headerRows: number[];
  confidence: number;
  warnings: ParserWarning[];
}

interface RowStats {
  filled: number;
  filledRatio: number;
  stringRatio: number;
  unique: boolean;
  singleMerge: boolean;
}

const rowCells = (m: CellMatrix, region: Region, r: number): (MatrixCell | null)[] => {
  const out: (MatrixCell | null)[] = [];
  for (let c = region.c0; c <= region.c1; c++) out.push(m.cells[r]?.[c] ?? null);
  return out;
};

const rowStats = (m: CellMatrix, region: Region, r: number): RowStats => {
  const cells = rowCells(m, region, r);
  const width = region.c1 - region.c0 + 1;
  const populated = cells.filter((c) => !isEmptyCell(c)) as MatrixCell[];
  const strings = populated.filter((c) => classifyCell(c) === "string");
  const texts = populated.map((c) => String(c.w ?? c.v).trim().toLowerCase());
  const anchors = new Set(populated.map((c) => (c.merge ? `${c.merge.r0},${c.merge.c0}` : null)));
  return {
    filled: populated.length,
    filledRatio: populated.length / width,
    stringRatio: populated.length ? strings.length / populated.length : 0,
    unique: new Set(texts).size === texts.length,
    singleMerge:
      populated.length >= 3 &&
      anchors.size === 1 &&
      !anchors.has(null) &&
      populated.length / width >= 0.5,
  };
};

/** Aggregate string-ness of the body rows (samples up to 30 rows). */
const bodyStringRatio = (m: CellMatrix, region: Region, fromRow: number): number => {
  let strings = 0;
  let populated = 0;
  const end = Math.min(region.r1, fromRow + 29);
  for (let r = fromRow; r <= end; r++) {
    for (const cell of rowCells(m, region, r)) {
      if (isEmptyCell(cell)) continue;
      populated++;
      if (classifyCell(cell) === "string") strings++;
    }
  }
  return populated ? strings / populated : 0;
};

const rowHasMergeSpan = (m: CellMatrix, region: Region, r: number): boolean =>
  rowCells(m, region, r).some((c) => c?.merge && c.merge.c1 > c.merge.c0 && c.merge.r0 === r);

/**
 * Identify title rows and header rows at the top of a region.
 *
 * Title rows: very sparse leading rows, or a single merge spanning most of
 * the region width. Headers: string-heavy, well-filled rows that differ from
 * the body. Two-row headers are recognized when a merged/partial group row
 * sits above a fully filled label row.
 */
export function detectHeaders(matrix: CellMatrix, region: Region): HeaderDetection {
  const warnings: ParserWarning[] = [];
  const width = region.c1 - region.c0 + 1;
  const height = region.r1 - region.r0 + 1;

  // 1. Peel off up to 2 title rows (only when enough rows remain below).
  const titleRows: number[] = [];
  let r = region.r0;
  while (titleRows.length < 2 && r < region.r1 - 1) {
    const s = rowStats(matrix, region, r);
    const sparse = width >= 3 && s.filled <= Math.max(1, Math.floor(width * 0.34));
    if (sparse || s.singleMerge) {
      titleRows.push(r);
      r++;
    } else break;
  }

  const noHeader = (confidence: number, code: string, message: string): HeaderDetection => ({
    titleRows,
    headerRows: [],
    confidence,
    warnings: [...warnings, { code, message, severity: "warning" }],
  });

  if (r > region.r1) return noHeader(0.2, "HEADER_NOT_DETECTED", "Region is empty below the title");

  const first = rowStats(matrix, region, r);
  const second = r + 1 <= region.r1 ? rowStats(matrix, region, r + 1) : null;
  const headerish = (s: RowStats) => s.filledRatio >= 0.5 && s.stringRatio >= 0.6;

  // 2. Two-row header: group row (merges or gaps) above a dense label row.
  if (
    height - titleRows.length >= 4 &&
    second &&
    headerish(second) &&
    first.stringRatio >= 0.6 &&
    (rowHasMergeSpan(matrix, region, r) || first.filledRatio < 0.7) &&
    second.filledRatio >= 0.7 &&
    bodyStringRatio(matrix, region, r + 2) < 0.6
  ) {
    return { titleRows, headerRows: [r, r + 1], confidence: 0.85, warnings };
  }

  // 3. Single-row header.
  if (headerish(first)) {
    const body = bodyStringRatio(matrix, region, r + 1);
    let confidence = 0.9;
    if (body >= first.stringRatio - 0.15) {
      // Body is stringy too (e.g. all-text table) — header is plausible but unsure.
      confidence = first.unique ? 0.65 : 0.5;
      warnings.push({
        code: "HEADER_UNCERTAIN",
        message: "First row assumed to be a header, but data rows look similar",
        severity: "warning",
      });
    }
    if (second && headerish(second) && bodyStringRatio(matrix, region, r + 2) < 0.5) {
      warnings.push({
        code: "MULTIPLE_HEADER_CANDIDATES",
        message: "More than one row could be the header",
        severity: "warning",
      });
    }
    return { titleRows, headerRows: [r], confidence, warnings };
  }

  // 4. No plausible header row.
  return noHeader(0.35, "HEADER_NOT_DETECTED", "No header row could be confidently detected");
}

/** Normalize raw header texts: trim, fill empties, dedupe (Revenue, Revenue_2, Column_3). */
export function normalizeHeaderNames(
  raw: (string | null)[]
): { names: string[]; hadDuplicates: boolean; hadEmpty: boolean } {
  const used = new Map<string, number>();
  const names: string[] = [];
  let hadDuplicates = false;
  let hadEmpty = false;

  raw.forEach((text, i) => {
    let base = (text ?? "").replace(/\s+/g, " ").trim();
    if (!base) {
      base = `Column_${i + 1}`;
      hadEmpty = hadEmpty || text !== undefined;
    }
    const key = base.toLowerCase();
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    if (count > 0) {
      hadDuplicates = true;
      names.push(`${base}_${count + 1}`);
    } else {
      names.push(base);
    }
  });

  return { names, hadDuplicates, hadEmpty };
}
