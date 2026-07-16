# Excel Table Studio — Implementation Plan

**Goal:** MVP that ingests complex `.xlsx`/`.xls` workbooks, auto-detects tables per sheet, renders them in an interactive Next.js UI, supports user corrections, and exports normalized JSON.

**Architecture:** Server-side parsing pipeline (SheetJS → cell matrix → region detection → header detection → type inference → normalized output) behind Zod-validated API routes. Workbooks persist as JSON + original file on local disk (`.data/`). Client renders tables with TanStack Table; corrections PATCH the stored JSON and re-extract from the original file. `DataSourceAdapter` interface reserved for future Databricks mapping.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · TanStack Table · Zod · SheetJS (`xlsx` 0.20.3 from cdn.sheetjs.com) · Vitest · Playwright

## Checklist

### Phase 0 — Scaffold
- [x] create-next-app (TS, Tailwind, App Router, src dir)
- [x] Install xlsx, zod, @tanstack/react-table, vitest, @playwright/test
- [x] shadcn/ui init + components (button, card, badge, input, label, select, dialog, tabs, skeleton, table, separator, tooltip)

### Phase 1 — Parser core (`src/lib/excel/`)
- [x] Zod schemas + inferred types (`src/lib/schemas/workbook.ts`)
- [x] Config limits (`src/lib/config.ts`) — file size, row caps, preview rows (env-overridable)
- [x] `cell-matrix.ts` — sheet → cell matrix (raw/display/formula/type/address, merges, hidden rows/cols)
- [x] `detect-tables.ts` — region detection (blank row/col splits, title attachment, confidence, warnings)
- [x] `detect-headers.ts` — 1–2 row headers, title rows, dedupe/empty header normalization
- [x] `infer-types.ts` — string/integer/decimal/currency/percentage/boolean/date/datetime/formula/mixed/empty
- [x] `normalize-table.ts` — region + headers → ParsedTable (raw + display per cell)
- [x] `parse-workbook.ts` — orchestrates pipeline; handles corrupt/password/empty workbooks
- [x] Vitest unit tests: 10 scenarios (simple, multi-sheet, blank-row split, blank-col split, titles, dup headers, empty sheet, merged cells, mixed types, irregular rows)

### Phase 2 — Storage + API
- [x] `src/lib/storage/workbooks.ts` — save/load/update under `.data/workbooks/<id>/`
- [x] `POST /api/workbooks/upload` — ext/MIME/size validation, safe filenames, parse, persist
- [x] `GET /api/workbooks/[id]` — metadata + preview-limited rows
- [x] `PATCH /api/workbooks/[id]/tables/[tableId]` — rename, range, header row, exclude, column edits, split/merge (re-extract from original file)
- [x] `GET /api/workbooks/[id]/export/json` — full normalized JSON download
- [x] `GET /api/workbooks/[id]/sheets/[sheetIndex]/grid` — capped raw grid for sheet view
- [x] `POST /api/samples` — dev-only fixture loader

### Phase 3 — Frontend
- [x] Upload page: drag-drop, validation, progress, errors, recent uploads (session), sample buttons
- [x] Workbook page: sheet sidebar (table counts, warning dots), summary bar, table cards
- [x] `data-table.tsx` — TanStack: sort, filter/search, pagination, column visibility, sticky header, h-scroll
- [x] Correction dialog: rename table, header row, range, exclude, column rename/type, split, merge
- [x] Raw sheet view with table-boundary highlighting
- [x] Empty states, skeletons, responsive layout

### Phase 4 — Fixtures + E2E + polish
- [x] `scripts/make-fixtures.mjs` — 7 sample workbooks (simple sales, multi-sheet finance, two tables one sheet, messy titles/blanks, merged cells, formulas, duplicate headers)
- [x] Playwright: upload fixture → sheets + tables visible
- [x] `DataSourceAdapter` interface (`src/lib/adapters/`)
- [x] README (purpose, architecture, pipeline, heuristics, limitations, Databricks plan)
- [x] `npm run lint`, `tsc --noEmit`, `npm run build`, all tests green
