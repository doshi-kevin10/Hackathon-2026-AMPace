/**
 * The single authoritative registry for AMPace's canonical ad metrics. It is
 * the source of truth for metric identity, aggregation semantics (additive vs
 * ratio-of-sums), the Databricks column name, and display formatting.
 *
 * Mirrors the fixed 9-column schema in lib/databricks/sync.ts (DB_COLUMNS) and
 * the ratio-of-sums behaviour already used by lib/analytics/kpi.ts — do NOT
 * define metric math anywhere else.
 */

export const CANONICAL_FIELD_IDS = [
  "date",
  "day",
  "total_adspend",
  "clicks",
  "cpc",
  "revenue",
  "conversions",
  "roas",
  "cvr",
] as const;

export type CanonicalFieldId = (typeof CANONICAL_FIELD_IDS)[number];

export type MetricSemantic =
  | { kind: "temporal" }
  | { kind: "dimension" }
  | { kind: "additive"; aggregate: "sum" }
  | {
      kind: "ratio";
      numerator: CanonicalFieldId;
      denominator: CanonicalFieldId;
      zeroDenominator: "null";
    };

export type FieldFormat = "date" | "text" | "number" | "integer" | "currency" | "percentage";

export interface CanonicalFieldMeta {
  id: CanonicalFieldId;
  /** Human display name, matching the UI column header ("Total Adspend"). */
  displayName: string;
  /** Databricks column identifier (must exist in DB_COLUMNS). */
  dbColumn: string;
  semantic: MetricSemantic;
  format: FieldFormat;
  decimals: number;
}

export const CANONICAL_FIELDS: Record<CanonicalFieldId, CanonicalFieldMeta> = {
  date: { id: "date", displayName: "Date", dbColumn: "Date", semantic: { kind: "temporal" }, format: "date", decimals: 0 },
  day: { id: "day", displayName: "Day", dbColumn: "Day", semantic: { kind: "dimension" }, format: "text", decimals: 0 },
  total_adspend: {
    id: "total_adspend",
    displayName: "Total Adspend",
    dbColumn: "Total_Adspend",
    semantic: { kind: "additive", aggregate: "sum" },
    format: "currency",
    decimals: 2,
  },
  clicks: {
    id: "clicks",
    displayName: "Clicks",
    dbColumn: "Clicks",
    semantic: { kind: "additive", aggregate: "sum" },
    format: "integer",
    decimals: 0,
  },
  cpc: {
    id: "cpc",
    displayName: "CPC",
    dbColumn: "CPC",
    semantic: { kind: "ratio", numerator: "total_adspend", denominator: "clicks", zeroDenominator: "null" },
    format: "currency",
    decimals: 2,
  },
  revenue: {
    id: "revenue",
    displayName: "Revenue",
    dbColumn: "Revenue",
    semantic: { kind: "additive", aggregate: "sum" },
    format: "currency",
    decimals: 2,
  },
  conversions: {
    id: "conversions",
    displayName: "Conversions",
    dbColumn: "Conversions",
    semantic: { kind: "additive", aggregate: "sum" },
    format: "integer",
    decimals: 0,
  },
  roas: {
    id: "roas",
    displayName: "ROAS",
    dbColumn: "ROAS",
    semantic: { kind: "ratio", numerator: "revenue", denominator: "total_adspend", zeroDenominator: "null" },
    format: "number",
    decimals: 2,
  },
  cvr: {
    id: "cvr",
    displayName: "CVR",
    dbColumn: "CVR",
    semantic: { kind: "ratio", numerator: "conversions", denominator: "clicks", zeroDenominator: "null" },
    format: "percentage",
    decimals: 2,
  },
};

/** Every field, in canonical order. */
export const CANONICAL_FIELD_LIST: CanonicalFieldMeta[] = CANONICAL_FIELD_IDS.map((id) => CANONICAL_FIELDS[id]);

export const isCanonicalFieldId = (v: unknown): v is CanonicalFieldId =>
  typeof v === "string" && (CANONICAL_FIELD_IDS as readonly string[]).includes(v);

/** The additive base fields ratios are recomputed from. */
export const ADDITIVE_FIELD_IDS: CanonicalFieldId[] = CANONICAL_FIELD_IDS.filter(
  (id) => CANONICAL_FIELDS[id].semantic.kind === "additive"
);

export const fieldByDisplayName = (name: string): CanonicalFieldMeta | undefined =>
  CANONICAL_FIELD_LIST.find((f) => f.displayName.toLowerCase() === name.trim().toLowerCase());

/** Format a numeric value for display using the field's registered format. */
export function formatFieldValue(id: CanonicalFieldId, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const meta = CANONICAL_FIELDS[id];
  switch (meta.format) {
    case "currency":
      return `$${value.toLocaleString("en", { maximumFractionDigits: meta.decimals, minimumFractionDigits: 0 })}`;
    case "percentage":
      return `${(value * 100).toFixed(meta.decimals)}%`;
    case "integer":
      return Math.round(value).toLocaleString("en");
    case "number":
      return value.toLocaleString("en", { maximumFractionDigits: meta.decimals });
    default:
      return String(value);
  }
}
