import type { CellValue, ParsedTable } from "@/lib/schemas/workbook";
import { applyComputedColumn } from "./computed-columns";

/**
 * Canonical ad-performance columns. Detected headers are renamed onto this
 * vocabulary (original text preserved in `originalHeader`), missing derivable
 * metrics are computed, and canonical columns are ordered first.
 */
export const CANONICAL_ORDER = [
  "Date",
  "Day",
  "Total Adspend",
  "Clicks",
  "CPC",
  "Revenue",
  "Conversions",
  "ROAS",
  "CVR",
] as const;

const SYNONYMS: Record<(typeof CANONICAL_ORDER)[number], string[]> = {
  Date: ["date", "day date", "report date", "reporting date"],
  Day: ["day", "weekday", "day of week", "dow"],
  "Total Adspend": [
    "total adspend", "adspend", "ad spend", "total ad spend", "spend", "total spend",
    "cost", "total cost", "media spend", "amount spent", "media cost",
  ],
  Clicks: ["clicks", "click", "total clicks", "link clicks", "paid clicks"],
  CPC: ["cpc", "avg cpc", "average cpc", "cost per click", "avg cost per click"],
  Revenue: ["revenue", "rev", "total revenue", "sales", "sales revenue", "publisher revenue", "sot revenue"],
  Conversions: ["conversions", "conversion", "conv", "convs", "total conversions", "purchases", "orders", "ui conversions"],
  ROAS: ["roas", "return on ad spend", "return on adspend"],
  CVR: ["cvr", "conversion rate", "conv rate", "cr"],
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  LOOKUP.set(norm(canonical), canonical);
  for (const a of aliases) LOOKUP.set(a, canonical);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const has = (table: ParsedTable, name: string) =>
  table.columns.some((c) => c.name === name);

/** Add a Day column derived from the Date column's normalized ISO value. */
const deriveDay = (table: ParsedTable): void => {
  const dateCol = table.columns.find((c) => c.name === "Date");
  if (!dateCol) return;
  const id = `col_${table.columns.length + 1}`;
  for (const row of table.rows) {
    const iso = row[dateCol.id]?.normalized;
    let day: string | null = null;
    if (typeof iso === "string" && iso) {
      const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
      if (!Number.isNaN(d.getTime())) day = WEEKDAYS[d.getUTCDay()];
    }
    row[id] = {
      raw: day,
      normalized: day,
      display: day,
      formula: null,
      type: day == null ? "empty" : "string",
    } satisfies CellValue;
  }
  table.columns.push({
    id,
    name: "Day",
    originalHeader: null,
    sheetColumn: -1,
    inferredType: "string",
    typeOverride: null,
    formula: null,
  });
};

/**
 * Rename matched headers to canonical names, derive Day/CPC/ROAS/CVR when
 * their inputs exist, and order canonical columns first. Tables with fewer
 * than two canonical matches are left untouched (not ad-performance data).
 */
export function canonicalizeTable(table: ParsedTable): void {
  // Pass 1: find matches. Only a table with ≥2 canonical columns is treated as
  // ad-performance data — a lone "Sales" column in some other table stays untouched.
  const matched = new Map<string, (typeof table.columns)[number]>();
  for (const col of table.columns) {
    const canonical = LOOKUP.get(norm(col.name));
    if (canonical && !matched.has(canonical)) matched.set(canonical, col);
  }
  if (matched.size < 2) return;

  // Pass 2: rename onto the canonical vocabulary.
  for (const [canonical, col] of matched) col.name = canonical;

  if (!has(table, "Day")) deriveDay(table);

  const derivations: { name: string; formula: string; format?: "percent"; needs: string[] }[] = [
    { name: "CPC", formula: "[Total Adspend] / [Clicks]", needs: ["Total Adspend", "Clicks"] },
    { name: "ROAS", formula: "[Revenue] / [Total Adspend]", needs: ["Revenue", "Total Adspend"] },
    { name: "CVR", formula: "[Conversions] / [Clicks]", format: "percent", needs: ["Conversions", "Clicks"] },
  ];
  for (const d of derivations) {
    if (!has(table, d.name) && d.needs.every((n) => has(table, n))) {
      applyComputedColumn(table, d);
    }
  }

  const rank = (name: string) => {
    const i = (CANONICAL_ORDER as readonly string[]).indexOf(name);
    return i < 0 ? CANONICAL_ORDER.length : i;
  };
  table.columns.sort((a, b) => rank(a.name) - rank(b.name));
}

/** True when the table mapped onto the canonical ad-metrics vocabulary. */
export const isCanonicalTable = (table: { columns: { name: string }[] }): boolean =>
  table.columns.filter((c) => (CANONICAL_ORDER as readonly string[]).includes(c.name)).length >= 2;
