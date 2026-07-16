# Excel Table Studio

Upload complex Excel workbooks, automatically detect every table on every sheet, review and
correct the detection in a polished UI, and export the normalized result as JSON.

This is **phase 1** of a larger AI-automation project. Databricks, Slack, and AI analytics
integrations come later — the data model already carries the stable ids they will need
(see [Future Databricks integration](#future-databricks-integration)).

## Quick start

```bash
npm install
npm run fixtures     # generate the sample .xlsx workbooks into fixtures/
npm run dev          # http://localhost:3000
```

On the upload page you can drag-and-drop an `.xlsx`/`.xls` file, or use the
**Try a sample workbook** buttons (dev-only) to load one of the bundled fixtures.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build + serve |
| `npm test` | Vitest unit tests (parser pipeline, 12 scenarios) |
| `npm run test:e2e` | Playwright upload → workbook view test (starts its own server) |
| `npm run fixtures` | Regenerate sample workbooks in `fixtures/` |
| `npm run lint` | ESLint |

## Architecture

```
Browser ── upload (.xlsx/.xls) ──▶ POST /api/workbooks/upload
                                        │  validate ext/MIME/size/signature
                                        ▼
                              src/lib/excel/  (server-only pipeline)
                    parse-workbook → cell-matrix (+merged-cells)
                          → detect-tables → detect-headers
                          → infer-types → normalize-table
                                        │
                                        ▼
                       .data/workbooks/<id>/{original.xlsx, workbook.json}
                                        │
        GET /api/workbooks/:id  ◀───────┤ (preview: first 1000 rows/table)
        PATCH …/tables/:tableId ◀───────┤ (corrections re-extract from original)
        GET …/export/json       ◀───────┤ (full data)
        GET …/sheets/:i/grid    ◀───────┘ (raw grid for the sheet view)
```

Separation of concerns:

- `src/lib/excel/` — pure parsing pipeline, no I/O, unit-tested. Never evaluates formulas
  (reads formula text + cached values only); macros are never executed.
- `src/lib/schemas/workbook.ts` — Zod schemas are the single source of truth; all API
  responses are validated against them and the TS types are inferred from them.
- `src/lib/storage/` — local filesystem persistence (`.data/`), 24 h retention sweep.
  No database in this phase.
- `src/app/api/` — thin route handlers: validation, error mapping, response shaping.
- `src/components/` — upload flow, workbook explorer (TanStack Table), correction dialog,
  raw sheet grid.
- `src/lib/adapters/data-source-adapter.ts` — the future integration interface (unimplemented).

## Parser pipeline

1. **Read workbook** (`parse-workbook.ts`) — SheetJS with `cellNF/cellText/cellStyles`;
   magic-byte check (ZIP/CFB) rejects non-Excel bytes; classifies password-protected,
   corrupt, and empty workbooks into typed errors.
2. **Cell matrix** (`cell-matrix.ts`) — dense matrix of `{value, display, formula, type,
   number format}` per cell; hidden rows/cols recorded; capped by configurable row/cell
   limits. Merged ranges are expanded so covered cells mirror their anchor
   (`merged-cells.ts`).
3. **Region detection** (`detect-tables.ts`) — recursively decompose the used range by
   fully-blank row and column separators (a single blank *cell* never splits a table;
   merges keep regions connected). Tiny fragments just above a table become its title;
   stray fragments are reported as ignored notes.
4. **Header detection** (`detect-headers.ts`) — peels up to 2 title rows (sparse rows or a
   single wide merge), then scores rows on fill ratio / string ratio / uniqueness vs the
   body. Supports single-row headers, two-row headers ("Q1 - Rev" from merged group cells),
   and headerless tables (`Column_1…`). Duplicate/empty names normalized
   (`Revenue, Revenue_2, Column_3`), original text preserved.
5. **Type inference** (`infer-types.ts`) — per-cell classification from SheetJS type +
   number format: string / integer / decimal / currency / percentage / boolean / date /
   datetime; column type by 90 % dominance with numeric/date family merging; mostly-formula
   columns report as `formula`; disagreement → `mixed`. Values are never coerced — each
   cell keeps `raw`, `normalized` (ISO dates etc.), and `display`.
6. **Normalization** (`normalize-table.ts`) — emits `ParsedTable` with columns, rows keyed
   by stable column ids, confidence score (density + header confidence + row regularity +
   size), and warnings (`HEADER_NOT_DETECTED`, `IRREGULAR_ROWS`, `MERGED_CELLS`,
   `MOSTLY_EMPTY`, `DUPLICATE_HEADERS`, `FORMULA_HEAVY`, …). Warnings are kept in the data
   model and export but are not shown in the UI.
7. **Canonical ad-metrics columns** (`canonicalize.ts`) — when a table has ≥2 columns
   matching the canonical vocabulary (**Date, Day, Total Adspend, Clicks, CPC, Revenue,
   Conversions, ROAS, CVR** — synonyms like "Spend", "Cost", "Purchases", "Conv Rate" are
   mapped), headers are renamed onto it (original text preserved), missing derivable
   metrics are computed (Day from Date; CPC = Adspend/Clicks; ROAS = Revenue/Adspend;
   CVR = Conversions/Clicks), and canonical columns are shown first (others stay in the
   Columns menu).

### Computed columns (Excel-style formulas)

Users can add columns via **+ Add column** on any table: a name plus a formula such as
`[Revenue] - [Total Adspend]` or `Revenue / Clicks`. Formulas support `+ - * /`,
parentheses, and bracketed column references; they are parsed by a tiny safe evaluator
(`formula.ts`, no `eval`), computed server-side per row, persisted, and re-applied when the
table is re-extracted after a range/split/merge correction. Division by zero or missing
values yield blank cells, like Excel errors suppressed.

### How to add another detection heuristic

Each stage is a pure function over `CellMatrix`/`Region`. To add a heuristic:

1. Pick the stage (region finding → `detect-tables.ts`, header logic →
   `detect-headers.ts`, typing → `infer-types.ts`).
2. Add the signal as a scored condition rather than a hard rule where possible, and emit a
   `ParserWarning` when confidence is low instead of guessing silently.
3. Add a scenario to `src/lib/excel/pipeline.test.ts` (build the sheet with
   `XLSX.utils.aoa_to_sheet`, round-trip through a real buffer) and, if user-visible, a
   fixture in `scripts/make-fixtures.mjs`.

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/workbooks/upload` | multipart upload → parse → persist |
| `GET /api/workbooks/:id` | parsed workbook, rows truncated to preview size |
| `PATCH /api/workbooks/:id/tables/:tableId` | corrections: rename, range, header rows, exclude, column rename/type, `addColumn` (formula), `splitAtRow`, `mergeWithTableId` |
| `GET /api/workbooks/:id/export/json` | full normalized JSON download |
| `GET /api/workbooks/:id/sheets/:index/grid` | capped raw grid + table overlays |
| `GET/POST /api/samples` | dev-only fixture loader |

Errors are `{ error: { code, message } }` with codes like `UNSUPPORTED_FILE_TYPE`,
`FILE_TOO_LARGE`, `PASSWORD_PROTECTED`, `CORRUPT_WORKBOOK`, `EMPTY_WORKBOOK`, `NOT_FOUND`.

## Configuration

All limits are env vars with defaults (`src/lib/config.ts`): `EXCEL_MAX_FILE_MB` (20),
`EXCEL_MAX_ROWS_PER_SHEET` (50 000), `EXCEL_MAX_CELLS_PER_SHEET` (2 000 000),
`EXCEL_PREVIEW_ROWS` (1000), `EXCEL_GRID_MAX_ROWS/COLS` (300/80), `EXCEL_RETENTION_HOURS`
(24), `EXCEL_DATA_DIR`, `EXCEL_ENABLE_SAMPLES`.

## Security

- Extension + MIME allowlist, size limit, and container magic-byte validation on upload.
- Server-generated UUID ids only; filenames sanitized; user input never used as a path.
- Formulas are never evaluated; macros never run (`.xlsm`/`.xlsb` rejected by extension).
- Stored uploads swept after 24 h (configurable).

## Known limitations

- A fully blank row inside one logical table splits it (fix with the **Merge** correction);
  a blank *cell* or ragged rows do not.
- Header detection assumes headers are string-like; all-numeric headers (e.g. years as
  column labels) may be classified as data (`HEADER_NOT_DETECTED` — fix via
  **Header rows** correction).
- Merged data cells repeat their anchor value into covered cells rather than spanning.
- Column type overrides relabel the column; they do not re-normalize cell values.
- Preview shows the first 1,000 rows per table (scrollable, no pagination) (full data in the JSON export); the raw grid
  view caps at 300×80 cells.
- Storage is a local directory — single instance, no auth, uploads expire after 24 h.

## Future Databricks integration

Every layer keeps a stable id (`workbook → sheet → table → column`), preserved across user
corrections, so a later phase can persist mappings:

```
Excel workbook → sheet → detected table → normalized columns
             → Databricks catalog.schema.table → column mappings
```

`src/lib/adapters/data-source-adapter.ts` defines the `DataSourceAdapter` interface
(`listTables`, `getSchema`, `previewRows`, `validateMapping`) plus `TableMapping` /
`ValidationResult` types that a `DatabricksAdapter` will implement.
