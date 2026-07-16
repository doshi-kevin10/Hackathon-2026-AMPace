# AMPulse — Progress Summary (as of 2026-07-16)

**Repo:** https://github.com/doshi-kevin10/Hackathon-2026-AMPace · **App:** `excel-parser/` (Next.js 16, TypeScript)

## What it does today

Upload any Excel workbook → tables are auto-detected on every sheet → mapped to the 9
canonical ad metrics → reviewed/corrected in an Excel-like UI → synced to Databricks →
the UI live-mirrors the Databricks tables from then on.

## Built in three phases (all today)

### 1. Excel ingestion & table detection
- Server-side parsing pipeline (SheetJS, formulas never evaluated, macros never run):
  cell matrix → region detection (blank row/column separators, merged-cell handling,
  title attachment) → header detection (1–2 rows, duplicates normalized) → type
  inference (currency/percentage/date/etc. from number formats) → normalized JSON.
- Handles multi-sheet workbooks, multiple tables per sheet, tables not at A1, titles,
  merged cells, hidden sheets/rows, irregular rows, formulas (cached values only).
- Upload validation: extension, MIME, size limit, ZIP/CFB magic bytes; local storage
  under `.data/` with 24 h retention. Zod-validated APIs; corrections (rename, range,
  header rows, exclude, split, merge) re-extract from the original file.

### 2. Canonical ad metrics + Excel-like UI
- Every ad-performance table maps onto: **Date, Day, Total Adspend, Clicks, CPC,
  Revenue, Conversions, ROAS, CVR** — synonyms handled (Spend/Cost/SPEND → Total
  Adspend, DOW → Day, Orders/(UI) Conversions → Conversions, (SOT) Revenue → Revenue…),
  originals preserved, missing metrics derived (Day from Date, CPC, ROAS, CVR).
- Excel-style formula columns: "+ Add column" with e.g. `[Revenue] - [Total Adspend]`
  (safe evaluator, no eval; persists across corrections and into exports).
- Spreadsheet-like grid: scrollable (no pagination), gridlines, sticky headers, row
  numbers, sort/search, column menu. Warnings hidden from the UI.

### 3. Databricks integration (the automation loop, first half)
- **Excel → Databricks:** one click ("Sync to Databricks") pushes each eligible table to
  `dev_catalog_for_individual_use.kevin_dev.excel_<workbook>_<sheet>_<table>` with a fixed
  9-column schema — only the canonical metrics, nothing else. Safety: only `excel_`-prefixed
  tables writable, prod catalogs refused, SQL-injection-hardened literals, sheet TOTAL rows
  filtered out. Auth via the same env vars as the databricks CLI.
- **Databricks → UI:** synced cards show "⚡ Live · Databricks" and poll every 30 s, so
  table updates in Databricks appear in the frontend automatically.
- **Synced now** (from "hackathon Spread Sheet .xlsx"): Overstock (201 rows),
  BBB (1,661), Groupon ×4 (2/30/31/30), AA October (31), AA November (30).

## Verified (everything below was actually run)

- 25/25 Vitest unit tests (parser scenarios, formula engine, canonicalization, SQL generation)
- Playwright e2e (upload → sheets/tables render) + clean-console browser sweeps
- Production build green; live API smoke tests (upload, corrections, merge/split, export)
- **End-to-end automation test:** `UPDATE` on the Overstock table in Databricks appeared in
  the open frontend in **27 s** with no refresh; revert flowed through too, data restored.

## What's next

- Reverse half of the loop: Databricks → regenerate Excel / write-back, or push-based
  updates (webhook/job) instead of 30 s polling
- UI/UX iteration on the workbook view (per Kevin's note)
- Scheduled re-sync & drift detection via the `DataSourceAdapter` interface
