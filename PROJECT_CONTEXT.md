# Excel Table Studio - Project Context

## Current Status
- Created: 2026-07-16
- Status: Active (phase-1 MVP complete)
- Current version: v01
- Last conversation: 2026-07-16

## Active Tasks
- [x] Phase-1 MVP: upload → parse → detect tables → review/correct → export JSON (2026-07-16)
- [ ] Phase 2 (future): Databricks mapping via `DataSourceAdapter` (interface defined, unimplemented)
- [ ] Nice-to-have: allow creating a table from an ignored region; virtualized raw grid for huge sheets

## Recent Changes (Last 30 Days)
### 2026-07-16 - Canonical ad-metrics columns, Excel-style formulas & grid
- Canonical column vocabulary (Date, Day, Total Adspend, Clicks, CPC, Revenue, Conversions, ROAS, CVR): headers matched via synonyms and renamed (original kept in `originalHeader`); Day/CPC/ROAS/CVR auto-derived when inputs exist; canonical columns ordered/shown first (others hidden by default, toggleable in Columns menu). Applies only when ≥2 canonical columns match — files: src/lib/excel/canonicalize.ts
- Safe formula engine (no eval; + − × ÷, parens, `[Bracketed Names]`) + user "Add column" flow persisted as `computedColumns`, re-applied after range/split/merge corrections — files: src/lib/excel/formula.ts, src/lib/excel/computed-columns.ts, corrections.ts, table-card.tsx
- DataTable rebuilt Excel-like: scrollable grid (NO pagination), gridlines, sticky header + row numbers, ƒ marker w/ formula tooltip on computed columns — files: src/components/tables/data-table.tsx
- Warnings hidden everywhere in UI (still in data model/export) — files: table-card.tsx, sheet-sidebar.tsx, summary-bar.tsx, workbook-view.tsx
- Preview rows default 100 → 1000 (`EXCEL_PREVIEW_ROWS`); new `ad-performance.xlsx` fixture + sample; playwright port override `E2E_PORT`
- Verified: 19/19 vitest, e2e pass, prod build, browser sweep (canonical headers, Profit column added via formula, friendly bad-formula error, no warnings shown)

### 2026-07-16 - Fix Base UI button console error + table scrolling
- `nativeButton={false}` on Buttons rendering `<a>`/`<Link>` (Base UI requirement) — files: src/components/workbook/summary-bar.tsx, src/components/workbook/workbook-view.tsx
- Added `containerClassName` to src/components/ui/table.tsx; DataTable now uses ONE scroll container (was nested scroll divs, which broke sticky headers/scrolling) — files: src/components/tables/data-table.tsx
- Verified via Playwright console sweep on live dev server: 0 console errors/warnings/page errors across upload, workbook view, sorting, search, raw grid, correction dialog

### 2026-07-16 - Initial build (entire app)
- Scaffolded Next.js 16 app in `excel-parser/` (TS, Tailwind 4, shadcn/ui Base-UI variants, TanStack Table, Zod 4, SheetJS 0.20.3 from cdn.sheetjs.com)
- Parser pipeline in `src/lib/excel/` (matrix → region detection → header detection → type inference → normalize); 12 Vitest scenarios green
- API routes: upload / get / patch-table (rename, range, header rows, exclude, column edits, split, merge) / export json / sheet grid / dev samples
- UI: upload page (drag-drop, progress, recents, samples), workbook page (summary stats, sheet sidebar, table cards with sortable/filterable previews, correction dialog, raw-grid view with table-boundary highlighting)
- 7 generated fixtures (`npm run fixtures`), 1 Playwright e2e (passing), README, PLAN.md
- Verified: `tsc` clean, lint 0 errors (2 benign TanStack warnings), `npm run build` succeeds, live API smoke test incl. corrupt-file rejection and merge/split round-trip

## Key File Locations
| Purpose | Path |
|---------|------|
| App root | /Users/kdoshi/Desktop/AMPulse/excel-parser |
| Parser pipeline | src/lib/excel/ |
| Shared Zod schemas/types | src/lib/schemas/workbook.ts |
| API routes | src/app/api/ |
| UI components | src/components/ |
| Fixtures generator | scripts/make-fixtures.mjs |
| Future Databricks interface | src/lib/adapters/data-source-adapter.ts |

## Known Issues
- Blank row inside one logical table splits it (user fixes via Merge correction)
- All-numeric header rows may be detected as data (user fixes via Header rows correction)
- `react-hooks/incompatible-library` lint warnings from TanStack Table (benign, upstream)

## History (Archive)
<details>
<summary>Older Changes (30+ days ago)</summary>
</details>

## Context Metadata
- Last updated: 2026-07-16 11:55
- Update count: 3
