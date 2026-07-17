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
- [x] Data-tab editable grid: calc-column UI, Excel export, inline edit + add-row, activity feed (2026-07-16)
- [x] Data-tab multi-sheet workspace: per-month colored sheets, custom tables (from data), cell notes, formula-list panel (2026-07-16)
- [x] Slack alerts: rich Block Kit messages + anomaly/WoW/data-quality/forecast triggers wired to webhook (2026-07-16)
- [x] Analytics rebuilt as agent-built dashboard: top-right AMPace chatbot drops/removes Tableau-style widgets (2026-07-16)
- [x] AMPace chatbot also fires personal Slack alerts: describe an alert → sends one fixed Block Kit message via the webhook (2026-07-16)
- [ ] Deferred from full spec (REFACTOR_PLAN.md): Postgres/Prisma, roles+admin CRUD, saved views
- [ ] Follow-up cleanup: delete now-unlinked Excel parser lib + orphaned fixtures/client-api/adapters; old analytics (advanced-analytics/*, forecasting/*, agent-panel) now dormant on disk

## Recent Changes (Last 30 Days)
### 2026-07-16 - Data tab → multi-sheet workspace (months, custom tables, notes, formula list)
- **Data tab is now a sheet workspace**, not a single grid. New orchestrator `components/tables/data-workspace.tsx` (owns the fetch, moved out of `company-view.tsx`) renders a colored **sheet strip**: `All` + one tab per month + user custom tables + `New table`.
- **Per-month segregation + colors:** `lib/datatab/sheets.ts` (pure) — `monthSheets()` groups the 180-day live data into distinct months (most-recent first, each a `--chart-1..8` color), `filterByMonth()` slices a derived table keeping `keys[]` aligned so edits/notes still hit the right original row. `DataTable` gained an `accentColor` prop (colored top border + tinted header).
- **Custom tables, seeded from data:** `lib/datatab/use-custom-tables.ts` — each custom table = a frozen `{columns,rows}` snapshot (`buildSnapshot()` flattens formulas to static/editable) + its own `LocalEdits`, persisted to `localStorage` key `ampulse:customtables:<name>`. `New table` snapshots the current active sheet's view (All / a month / another custom table), prompts for a name, opens it. Per-tab ⋯ menu: recolor (8 swatches), Rename, Delete.
- **Cell notes:** `LocalEdits.notes` (optional, back-compat) keyed like `edits`; `components/tables/cell-note.tsx` = Popover (view/edit/delete) + corner marker. Shared across `All` + month views; custom tables have their own.
- **Formula list:** `components/tables/formula-panel.tsx` — a `Formulas (n)` popover listing every calc column with its formula + remove. Add still via the existing `AddColumnDialog`.
- **Shared edit-layer algebra:** pure `with*` transforms in `lib/datatab/derive.ts` power both the live hook and custom tables. NEW `components/ui/popover.tsx` (base-ui wrapper, no new dep). All client-side — Databricks stays read-only.
- Files: NEW lib/datatab/{sheets,sheets.test,use-custom-tables}.ts, components/tables/{data-workspace,cell-note,formula-panel}.tsx, components/ui/popover.tsx; EDITED lib/datatab/{derive,use-local-edits}.ts, components/tables/data-table.tsx, components/company-view.tsx (inline DataGrid removed → DataWorkspace).
- Verified: tsc clean, eslint 0 errors (1 pre-existing TanStack warning), 241/241 vitest (+5 sheets tests), `next build` green. NOT browser-clicked (client-only, mock mode; needs `npm run dev`): tab switching, note popover, custom-table create/recolor/delete.

### 2026-07-16 - Split into two top-bar bots: AMPace (analytics) + Slack (alerts)
- Separated the two intents into **two distinct top-bar chat bots** side by side. **AMPace** (`components/agent/ampace-chat.tsx`, Sparkles) is analytics-only now — Slack intent removed. **Slack** bot (`components/agent/slack-bot.tsx`, MessageSquare icon — lucide has no `Slack` glyph in this version) describes/fires alerts via `POST /api/alerts/send`.
- Extracted a shared **`ChatDrawer`** shell (`components/agent/chat-drawer.tsx`) — owns open/messages/input UI + `useCompanyContext()` (reads company from URL); each bot supplies an `onSubmit(text) → assistant ChatMsg`. Both mounted in `app-header.tsx`.
- Verified: `next build` green + TS clean, eslint 0 errors, 236/236 vitest; both `>AMPace<` and `>Slack<` buttons render in the header.

### 2026-07-16 - Chatbot renamed AMPace + personal Slack alerts
- **Renamed the chatbot Analyst → AMPace** (`components/agent/ampace-chat.tsx`, replaces `analyst-chat.tsx`; `app-header.tsx` import; empty-state copy in `dashboard-canvas.tsx`; persona line in `/api/assistant`). The demo user is still "Ana Analyst" (unrelated).
- **AMPace now also sends Slack alerts.** Same one chatbot: if a prompt matches Slack intent (`\bslack\b`, "notify/ping/text/dm me", "alert me", "daily/weekly digest", "let me/tell me know when", …) it fires a **single fixed, curated Block Kit alert** to the webhook instead of adding a widget; otherwise the existing widget flow runs. New `POST /api/alerts/send` builds that fixed alert (severity critical, "<Company> · ROAS dropped below target", personalized to the URL's company via `ownerFor`/deep-link) and reuses `lib/alerts/slack.ts` `sendSlackAlert`. Deterministic confirmation in chat (no Claude dependency for the Slack path). No-ops with a friendly message when `SLACK_WEBHOOK_URL` is unset.
- Verified: eslint 0 errors, `next build` green + TS clean, 236/236 vitest. Runtime: AMPace button renders in the header; `POST /api/alerts/send` returned `ok:true` and **delivered a live message** to the webhook ("Nike · ROAS dropped below target"). Not browser-clicked: the chatbot drawer Slack path (needs `npm run dev`).

### 2026-07-16 - Analytics tab → agent-built dashboard + AMPace chatbot
- **Analytics tab rebuilt from scratch.** The pre-built `AnalyticsWorkspace` (forecast/anomaly/correlation/etc. panels) is replaced by a blank per-company **DashboardCanvas** (`components/dashboard/dashboard-canvas.tsx`) that renders only widgets the user adds. Old analytics components/routes/forecasting lib left dormant on disk (not deleted). `company-view.tsx` analytics branch now renders `<DashboardCanvas>`.
- **Top-right Analyst chatbot** (`components/agent/analyst-chat.tsx`, replaces `AgentPanel` in `app-header.tsx`): detects the company from the URL, routes the prompt to widget specs, drops them on that company's dashboard instantly, and dispatches `ampulse:show-analytics` so `CompanyView` switches to the Analytics tab. Widget selection is **deterministic/hardcoded** (`lib/dashboard/widgets.ts` `routePrompt` — keyword→widget with a rich fallback so ANY demo prompt yields relevant analytics); the chat *reply* is generated by Claude via `POST /api/assistant` (`claude-opus-4-8`, effort low) with an instant hardcoded fallback so a stage failure never blanks the chat. Verified live: `source:"claude"`.
- **Widgets (Tableau-grade, `components/dashboard/widget-card.tsx`):** kpi tiles, line (metric over Date), barDow (metric by day of week), compare (cross-company bar from `/api/datasets`), alerts (deterministic WoW/target signals), table (top days). Reuse existing `charts/{line,bar}-chart.tsx` + validated `--chart-1..8` palette (color follows metric, not rank); pure aggregations in `lib/dashboard/compute.ts`. Each widget deletable (× on hover); dashboard persists per company in `localStorage` (`ampulse:dashboard:<name>`), broadcast via window event. All local — never writes to Databricks.
- Files: NEW lib/dashboard/{widgets,widgets.test,compute,compute.test}.ts, components/dashboard/{dashboard-canvas,widget-card}.tsx, components/agent/analyst-chat.tsx, app/api/assistant/route.ts; EDITED components/{company-view,app-header}.tsx, app/datasets/[name]/analytics/page.tsx (full-height shell). DORMANT (unused): components/advanced-analytics/*, components/agent/agent-panel.tsx, /api/agent.
- Verified: 236/236 vitest (12 new: routing always ≥1 widget + keyword routing + compute series/dow/top-rows), `next build` green + TS clean, eslint 0 errors. Runtime: analyst login → analytics page SSRs 200 → `/api/assistant` returns a live Claude reply. NOT browser-clicked: widget rendering, chatbot drawer, delete, tab auto-switch (need `npm run dev` — mock mode default).
### 2026-07-16 - Slack alerts: rich Block Kit + all four triggers wired
- **Delivery layer rewritten** (`lib/alerts/slack.ts`): `SlackAlert` struct → `buildSlackMessage()` (pure) renders Block Kit — severity-colored bar (Slack red/amber/green/blue), severity-emoji header, metric/when fields, context footnote, "View in AMPulse" + optional news button. Deep links resolved absolute via `APP_BASE_URL` (button omitted if unusable). Always emits a `text` fallback. `sendSlackAlert(alert)` never throws.
- **Four triggers → two dispatch points:** (1) per-dataset **monitor route** owns anomalies (news-explained, upgraded plain-text → rich); (2) cross-company **notifications feed** (`notifications/service.ts` cache factory) pushes WoW moves + data-quality issues, deduped via `alert-store`. Forecast **low-confidence** runs alert from `forecasting/service.ts` (deduped per data version). Robust anomalies in the feed stay in-app only (monitor owns them) to avoid double-pings.
- **watchtower.ts:** added `kind:"quality"` + period-scoped `alertKey` (fixes date-less WoW keys being suppressed forever) + pure `qualityNotifications()` (gated ≥14 pts, excludes `insufficient_history`).
- **New:** `lib/alerts/dispatch.ts` (Notification→SlackAlert + per-company claim/send), `POST /api/alerts/test` (auth-guarded webhook smoke test), `lib/alerts/slack.test.ts` (6 builder tests).
- **Env:** `SLACK_WEBHOOK_URL` + `APP_BASE_URL` wired into `.env.local` (real webhook) and documented in `.env.example`.
- Verified: `tsc --noEmit` clean; slack/watchtower/forecasting suites 14/14; **live end-to-end** — 3 real messages (positive/critical/warning) POSTed to the webhook, all `200 ok`. NOT browser-clicked: the bell-poll → feed dispatch path (needs `npm run dev` + Databricks).
- **Owners + styling redesign (follow-up):** `lib/alerts/owners.ts` — config map (dataset → {name, email, slackId?}) seeded for demo companies + `ALERTS_DEFAULT_OWNER`/`ALERTS_DEFAULT_OWNER_SLACK_ID` fallback; `ownerFor(dataset)` wired into all three dispatch sites (test endpoint uses the logged-in user). `buildSlackMessage` reworked: Status/Metric/When field grid, a dedicated **Owner section** (`👤 *Owner:*` — a Slack `<@id>` @-mention when a slackId is set, so owners get pinged; mentions in context blocks don't notify), a divider before the CTA buttons, and a `📡 AMPulse` provenance footer. +3 owner tests (17/17). Re-verified live — 3 redesigned messages `200 ok`.

### 2026-07-16 - Data tab: local editable Excel-like grid + activity feed
- Removed KPI summary cards from the Data tab (deleted `components/kpi-summary.tsx`, now unused).
- Data tab is now **full-page**: `datasets/[name]/page.tsx` is `h-svh` flex column; `CompanyView` main flex-fills; the grid fills remaining viewport height. `CompanyView` keyed by `name` so it remounts on dataset nav (avoids ref-in-render under React Compiler strict lint). Analytics tab unchanged (centered, scrolls).
- **Local edit layer (never touches Databricks):** `lib/datatab/derive.ts` (pure `deriveTable` = base rows + appended rows + cell overrides → then `applyCalcColumns`; `editedCell`, `blankRow`, `editKey`) + `lib/datatab/use-local-edits.ts` (per-dataset state persisted to `localStorage` key `ampulse:datatab:<name>`; actions log to the activity feed). Cell edits keyed by positional row index (`row.index`, stable via `getRowId`).
- **Calc columns (req 3+7):** wired existing `lib/formula/calc-columns.ts` + eval-free `lib/excel/formula.ts` into new `components/tables/add-column-dialog.tsx` (name + formula + number/currency/% + live first-row preview + clickable column chips). Delete via ƒ-column header ×.
- **Excel export (req 5):** `data-table.tsx` dynamic-imports `xlsx` on click; exports FULL table (all rows/cols incl. calc + edits, ignores sort/filter/visibility) → `<Label>.xlsx`.
- **Inline editing + add/delete row:** double-click a base cell to edit (calc/ƒ columns read-only); "Add row" appends a blank local row; hover a row number → trash icon deletes it (local `deletedRows` set; logged). `deriveTable` now returns `keys[]` (original index per surviving row) so edit/delete stay aligned after rows are filtered out; grid `getRowId` uses it; row-number column shows display order.
- **Date range filter (req 2 follow-up):** toolbar From→To `<input type=date>` on the detected date column (ISO strings compare lexicographically); replaces that column's inconvenient text filter (shows "use range ↑" hint in the filter row). Implemented as a TanStack column filter with a range `filterFn`.
- **Activity feed (req 6):** top-bar `History` icon `components/activity/activity-feed.tsx` + `lib/activity/log.ts` (localStorage `ampulse:activity`, window-event broadcast, unread badge vs `ampulse:activity-seen`, relative time). Logs add-row/edit-cell/add-column/delete-column/download; click → navigate to dataset. Added to `app-header.tsx` next to NotificationsBell.
- Files: NEW lib/activity/log.ts, lib/datatab/{derive,derive.test,use-local-edits}.ts, components/{activity/activity-feed,tables/add-column-dialog}.tsx; EDITED components/{company-view,tables/data-table,app-header}.tsx, app/datasets/[name]/page.tsx; DELETED components/kpi-summary.tsx.
- Verified: 218/218 vitest (4 new derive tests), `next build` green + TS clean, eslint 0 errors (1 pre-existing TanStack warning). Runtime: analyst login → `/api/datasets/excel_company_nike` returns 9 cols × 180 rows; dataset page SSRs 200 with feed present, no runtime errors. NOT browser-clicked: dialog/inline-edit/xlsx-download interactions (need a browser — run `npm run dev`, mock mode is default).
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
- Last updated: 2026-07-16 19:45
- Update count: 7
