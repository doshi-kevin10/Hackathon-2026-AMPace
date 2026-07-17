const DATASET_PREFIX = "excel_company_";

/**
 * Display-name overrides for demo companies (Databricks table slug → shown name).
 * Anything not listed falls back to prettifying the slug.
 */
const LABEL_OVERRIDES: Record<string, string> = {
  excel_company_aa: "American Airlines",
  excel_company_bbb: "BoB",
  excel_company_overstock: "Amazon",
  // excel_company_groupon → "Groupon" via the fallback below
};

// Short all-letter tokens are acronyms (aa→AA); others title-case.
const titleToken = (t: string): string =>
  /^[a-z]{1,3}$/.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);

/** Human label for a company dataset slug. Overrides win; else prettify the slug. */
export function companyLabel(slug: string): string {
  return (
    LABEL_OVERRIDES[slug] ??
    slug
      .replace(new RegExp(`^${DATASET_PREFIX}`), "")
      .split("_")
      .filter(Boolean)
      .map(titleToken)
      .join(" ")
      .trim()
  );
}
