# AMPulse - Project Context

> Product pivoted 2026-07-16: Excel-parser → **Databricks-backed live analytics workspace** (login-gated). Excel is no longer an input.

## Current Status
- Created: 2026-07-16
- Status: Active (pivoted MVP — auth + live Databricks analytics)
- Current version: v02 (pivot)
- Last conversation: 2026-07-16

## Active Tasks
- [x] Phase-1 (superseded): Excel upload → parse → detect → correct → JSON (2026-07-16)
- [x] Phase-2 (superseded): Excel→Databricks sync + live mirror (2026-07-16)
- [x] PIVOT: descoped Databricks analytics workspace — auth, dataset browse, sort/filter, live 30s refresh (2026-07-16)
- [ ] Deferred from full spec (REFACTOR_PLAN.md): Postgres/Prisma, roles+admin CRUD, saved views, calc-column UI, Excel export
- [ ] Follow-up cleanup: delete now-unlinked Excel parser lib + orphaned fixtures/client-api/adapters

## Recent Changes (Last 30 Days)
### 2026-07-16 - PIVOT to Databricks analytics workspace (descoped from full spec)
- User pivoted product: Databricks = source of truth; Excel removed as input. Descoped the 6-stage spec to: auth + display Databricks tables + sort/filter + live refresh. No Postgres (use Kevin's Databricks workspace). See REFACTOR_PLAN.md §0.
- Auth (dev-only, no DB): `lib/auth/` — dev users in `config.ts`; `jose`-signed JWT cookie session (`session.ts`, edge-safe); node-only scrypt password check (`credentials.ts`); `server.ts` guards. `middleware.ts` gates all routes (pages→/login, api→401). Routes: `/login`, `/api/auth/{login,logout}`, `/api/me`.
- **Gotcha fixed:** middleware runs on edge; must NOT import `node:crypto`. Split password check into `credentials.ts` (node) vs `session.ts` (jose/edge) — importing crypto into middleware 500s every route.
- Analytics: `lib/databricks/analytics.ts` — `listDatasets()` (SHOW TABLES LIKE 'excel_*' in kevin_dev), `getDatasetRows()` reuses `sync.pullLiveTable`. Name allowlist (`^[a-z0-9_]+$` + `excel_` prefix) blocks traversal/injection. APIs `/api/datasets`, `/api/datasets/[name]` (auth + allowlist).
- UI: `/` dashboard (dataset cards), `/datasets/[name]` (live grid via reused `data-table.tsx`, sort/search + client date-range filter, 30s poll w/ AbortController, freshness indicators), `app-header` w/ logout. Rebranded to AMPulse.
- Removed: `app/api/workbooks/**`, `app/api/samples`, `app/workbooks/**`, `components/upload/*`, `components/workbook/*`, old upload e2e (19 files). Excel parser lib LEFT on disk (unlinked) for later deletion.
- Verified: 32/32 vitest (added auth session + dataset-allowlist tests), 2/2 new e2e (unauth redirect + analyst login→cards→grid), prod build green, browser sweep clean (login→dashboard→grid→sort→date-filter 201→5→search→logout). API checks: unauth 401, removed upload 404, `path_metrics` rejected 404, login+me+datasets(8)+rows(9 canonical cols) OK.

### 2026-07-16 - Databricks sync + live mirror (phase 2 start)
- `src/lib/databricks/client.ts`: minimal SQL Statement Execution API client (REST, env auth: DATABRICKS_HOST/TOKEN, warehouse default `060a27190dd3ecb5` dev-SQLusers serverless, override DATABRICKS_WAREHOUSE_ID)
- `src/lib/databricks/sync.ts`: pushes eligible (canonical) tables to `dev_catalog_for_individual_use.kevin_dev.excel_<wb>_<sheet>_<table>` with fixed 9-col schema (Date, Day, Total_Adspend, Clicks, CPC, Revenue, Conversions, ROAS, CVR); only `excel_`-prefixed tables writable; dateless (TOTAL) rows filtered; `pullLiveTable` reads back for UI
- Routes: `POST /api/workbooks/:id/sync`, `GET /api/workbooks/:id/tables/:tableId/live`; `table.databricks` mapping in schema, preserved across corrections
- UI: "Sync to Databricks" button (summary bar); synced cards show "⚡ Live · Databricks" and poll every 30s → Databricks-side edits appear automatically
- Synonyms added: "sot revenue"→Revenue, "ui conversions"→Conversions (kevin's real workbook headers)
- SYNCED: 8 tables from "hackathon Spread Sheet .xlsx" (Overstock 201, BBB 1661, Groupon 2/30/31/30, AA Oct 31, AA Nov 30 rows) — verified via SELECT
- 24/24 vitest (5 new sync SQL tests), build green, browser sweep clean
- Live loop verified end-to-end: UPDATE on Databricks -> frontend cell changed automatically in 27s (30s poll, `LIVE_POLL_MS`); revert also confirmed, data restored

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
| GitHub repo | https://github.com/doshi-kevin10/Hackathon-2026-AMPace (branch: main) |
| Auth | src/lib/auth/ (config, session[jose], credentials[node], server, middleware.ts) |
| Analytics layer | src/lib/databricks/analytics.ts (+ reuses sync.pullLiveTable) |
| New pages | src/app/{login,page(dashboard),datasets/[name]}, components/{app-header,dashboard,dataset-view} |
| App root | /Users/kdoshi/Desktop/AMPulse/excel-parser |
| Parser pipeline | src/lib/excel/ |
| Shared Zod schemas/types | src/lib/schemas/workbook.ts |
| API routes | src/app/api/ |
| UI components | src/components/ |
| Fixtures generator | scripts/make-fixtures.mjs |
| Future Databricks interface | src/lib/adapters/data-source-adapter.ts |

## Known Issues
- Dev-credentials auth only (plaintext demo pwds in config) — NOT for production; swap for Auth.js/Clerk
- Excel parser lib + fixtures still on disk but unlinked (dead code pending cleanup)
- Blank row inside one logical table splits it (user fixes via Merge correction)
- All-numeric header rows may be detected as data (user fixes via Header rows correction)
- `react-hooks/incompatible-library` lint warnings from TanStack Table (benign, upstream)

## History (Archive)
<details>
<summary>Older Changes (30+ days ago)</summary>
</details>

## Context Metadata
- Last updated: 2026-07-16 13:55
- Update count: 5
