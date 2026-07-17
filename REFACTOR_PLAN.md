# AMPace Refactor Plan — Excel Parser → Databricks Analytics Workspace

**Status:** building (descoped — see §0)
**Goal:** Pivot from "Excel is the source of truth" to "Databricks is the source of truth," behind a login-gated live analytics view.

## 0. Confirmed scope (overrides the full spec below)

The user descoped the original 6-stage spec to a focused MVP:

- **Backend:** Kevin's Databricks workspace (`dev_catalog_for_individual_use.kevin_dev`) — **no Postgres/Prisma**. App metadata stays trivial (dev users in config); nothing new is persisted.
- **Build only:** (1) **auth** — login-gated app; (2) **display Databricks tables** — browse the datasets already in Kevin's workspace; (3) **sort / filter**; (4) **live data** — auto-refresh (reuse the existing 30s poll).
- **Columns:** the canonical ad metrics already defined — **Date, Day, Total Adspend, Clicks, CPC, Revenue, Conversions, ROAS, CVR** (the set referenced throughout; adjust in one place if a subset is wanted).
- **Explicitly NOT in this build** (spec features deferred): Postgres/Prisma, roles matrix + admin user/company/assignment CRUD, saved views, calculated-column UI, Excel export. The formula engine and export helper remain on disk, easy to re-enable.
- **Auth mechanism:** minimal signed-cookie session via `jose` (dev users in config, hashed with node `scrypt`). Chosen over Auth.js to avoid Next 16 integration risk for a dev-only login; documented as **not for production**. Trivial to swap for Auth.js/Clerk later.
- **Cleanup:** replace the Excel-upload landing with the login-gated dashboard and remove upload-as-input UI framing. The Excel parsing lib is left in place (unlinked, dead) — full deletion (spec Stage 5) is a separate follow-up, not done here to keep the diff focused.

Everything from §1 on is the original full-spec analysis, retained for the later phases.

---

**Goal (full spec):** Pivot from "Excel is the source of truth" to "Databricks is the source of truth; Excel is export-only," behind a multi-user, permission-scoped analytics workspace.

---

## 1. Current architecture (what exists today)

Single-tenant, no auth. Flow: upload `.xlsx` → server parses → detect tables → canonicalize to ad metrics → sync to Databricks → UI polls Databricks live.

| Area | Files |
|---|---|
| Excel ingestion | `src/lib/excel/*` (parse-workbook, cell-matrix, detect-tables, detect-headers, infer-types, normalize-table, merged-cells, corrections, types) |
| Canonical metrics | `src/lib/excel/canonicalize.ts` |
| Formula engine | `src/lib/excel/formula.ts`, `computed-columns.ts` |
| Databricks | `src/lib/databricks/client.ts` (SQL exec API), `sync.ts` (push + `pullLiveTable` read + safe-SQL helpers + `DB_COLUMNS`) |
| Storage | `src/lib/storage/workbooks.ts` (local `.data/` JSON + original file) |
| Schemas | `src/lib/schemas/workbook.ts` (Zod: ColumnType, CellValue, ParsedColumn, …) |
| API | `src/app/api/workbooks/**`, `api/samples` |
| UI | `src/app/page.tsx` (upload), `app/workbooks/[id]`, `components/upload/*`, `components/workbook/*`, `components/tables/data-table.tsx` |
| Tests/fixtures | `e2e/upload.spec.ts`, `src/**/*.test.ts`, `fixtures/*.xlsx`, `scripts/make-fixtures.mjs` |

---

## 2. File inventory: RETAIN / MODIFY / REMOVE

### RETAIN & RELOCATE (reusable, minimal change)
| File | New home | Change |
|---|---|---|
| `lib/excel/formula.ts` | `lib/formula/formula.ts` | none — pure evaluator (`parseFormula`, `evaluate`, `referencedNames`); already decoupled |
| `lib/databricks/client.ts` | same | none — `executeStatement` is the read primitive |
| `lib/excel/canonicalize.ts` → `CANONICAL_ORDER`, synonyms | `lib/analytics/canonical.ts` | keep metric vocabulary + synonym map; drop the `ParsedTable` mutation path |
| `components/ui/*` | same | none |
| `components/tables/data-table.tsx` | same | decouple from workbook types → generic `AnalyticsColumn`/`Row` |
| `lib/utils.ts`, `lib/format.ts` (TYPE_BADGE, formatCell, compact) | keep | drop workbook-only helpers (recent-workbooks storage) |

### MODIFY / GENERALIZE
| File | Change |
|---|---|
| `lib/databricks/sync.ts` | Extract the **read** half (`pullLiveTable`, `DB_COLUMNS`, `quoteIdent`, `fqn`, `sqlString`) into a new **read-only** `lib/databricks/analytics-source.ts`. Delete the **write** half (`syncWorkbookToDatabricks`, `createTableSql`, INSERT logic) — analytics is read-only. |
| `lib/excel/computed-columns.ts` | Generalize off `ParsedTable`/`CellValue` → operate on plain `Row[]` + column defs, reuse `formula.ts`. Move to `lib/formula/computed-columns.ts`. |
| `lib/schemas/workbook.ts` | Keep `ColumnType`, `CellValue`, `ColumnTypeSchema`; move to `lib/schemas/analytics.ts`. Drop workbook/table/patch schemas. |

### REMOVE (Excel-as-input; after replacements land — Stage 5)
- `lib/excel/`: parse-workbook, cell-matrix, detect-tables, detect-headers, infer-types, normalize-table, merged-cells, corrections, types + `pipeline.test.ts`
- `lib/storage/workbooks.ts`, `lib/adapters/data-source-adapter.ts` (superseded by `AnalyticsDataSource`)
- `lib/databricks/sync.ts` write path + `sync.test.ts` (keep generalized SQL tests)
- API: `api/workbooks/**` (upload, GET, sheets/grid, tables/patch, tables/live, sync, export/json), `api/samples`
- UI: `app/page.tsx` upload, `app/workbooks/**`, `components/upload/*`, `components/workbook/{correction-dialog,raw-sheet-view,sheet-sidebar,summary-bar,table-card,workbook-view}.tsx`
- `e2e/upload.spec.ts`, `fixtures/*.xlsx`, `scripts/make-fixtures.mjs`
- README/PLAN language framing Excel as the source of truth

**New for Excel EXPORT (output only):** `lib/export/excel.ts` using `xlsx` (already a dep) — build a workbook from the current query result + calculated columns + a summary sheet. This is the only surviving Excel code.

---

## 3. Target architecture

```
Browser (Auth.js session)
  │  structured AnalyticsQuery (never SQL)
  ▼
Next.js App Router
  ├── Auth.js (credentials in dev) — session + role
  ├── PostgreSQL via Prisma  ← users, roles, companies, assignments, saved views, audit
  │     (app metadata only — NEVER analytics rows)
  └── AnalyticsDataSource (read-only) ── Databricks SQL Exec API
        approved catalog.schema.table per Company; allowlisted columns; parameterized/sanitized
```

**Ownership:** Postgres = who-can-see-what + saved config. Databricks = the numbers. No analytics rows are copied into Postgres.

**Authorization is server-side and independent of the UI.** Every company-scoped API resolves the session → checks `UserCompanyAssignment` (or admin role) → resolves the Company's approved table → validates the query columns against the fetched schema → runs a read-only, bounded query.

---

## 4. Application data model (Prisma)

Matches the spec's entities with these improvements:
- `User.isActive`, `User.passwordHash` (dev credentials), `emailVerified` for Auth.js.
- `Company` holds the approved Databricks coordinates (`databricksCatalog/Schema/Table`) — users never send table names.
- `SavedView.calculatedColumns` and `filters`/`sorting` as `Json`; `visibleColumns String[]` (native Postgres array).
- `SavedView.isDefault` per (user, company); model allows a future `sharedWithTeam` flag.
- `AuditEvent` for every assignment/role/company change.
- Native `enum UserRole { SUPER_ADMIN ADMIN ANALYST VIEWER }`.

Migrations via `prisma migrate dev`; `prisma/seed.ts` seeds 4 roles' demo users + 5 companies + assignments.

---

## 5. Permission matrix (enforced server-side)

| Capability | SUPER_ADMIN | ADMIN | ANALYST | VIEWER |
|---|:--:|:--:|:--:|:--:|
| View assigned company data / filter / export | ✔ (all) | ✔ (all) | ✔ (assigned) | ✔ (assigned) |
| Create calculated columns / saved views | ✔ | ✔ | ✔ | – (view only) |
| Manage assignments | ✔ | ✔* | – | – |
| Manage users & roles | ✔ | – | – | – |
| Create/edit companies + Databricks config | ✔ | – | – | – |

\*regular admins manage assignments only if permitted. Admins/super-admins implicitly see all companies.

---

## 6. Routes

**Add:** `GET /api/me`, `GET /api/companies`, `GET /api/companies/:id`, `GET …/schema`, `POST …/query`, `GET …/freshness`, `POST …/export`, `GET/POST /api/saved-views`, `PATCH/DELETE /api/saved-views/:id`, admin: `GET/PATCH /api/admin/users(/:id)`, `GET/POST/PATCH /api/admin/companies(/:id)`, `POST /api/admin/companies/:id/test`, `POST /api/admin/assignments`, `DELETE /api/admin/assignments/:id`. Pages: `/login`, `/dashboard`, `/companies/[slug]`, `/saved-views`, `/admin/{users,companies,assignments}`.

**Remove:** all `/api/workbooks/**`, `/api/samples`, `/workbooks/**`, upload `/`.

---

## 7. Databricks access layer (`AnalyticsDataSource`)

`getCompanySchema` (cached `DESCRIBE`), `getCompanyRows`, `getCompanySummary` (KPI aggregates), `getFreshness` (`MAX(Date)`, row count, last query time). Query builder: Zod-validate `AnalyticsQuery`; **every referenced column must exist in the approved schema** (reject otherwise); values rendered with the existing hardened `sqlString`/typed literals; hard `LIMIT` cap; company table comes from Postgres, never the request. No writes, ever.

---

## 8. Staged execution (incremental, git history preserved)

- **Stage 1** — Prisma + Postgres + Auth.js; schema, migration, seed (users/companies/assignments); protected-route middleware; `/login`, `/api/me`.
- **Stage 2** — `/dashboard` company cards (permission-scoped); nav shell; remove upload landing.
- **Stage 3** — `AnalyticsDataSource` + `/api/companies/:id/{schema,query,freshness}`; `/companies/[slug]` grid wired to Databricks (reuse generalized `data-table.tsx`); KPI row; 30s polling (reuse existing pattern) + cancellation.
- **Stage 4** — calculated columns (reuse formula engine) + saved views CRUD + persistence.
- **Stage 5** — Excel export (`/api/companies/:id/export`); **delete** obsolete upload/parse code + tests/fixtures.
- **Stage 6** — admin UIs (users/companies/assignments) + audit events; full test suite + README rewrite.

Each stage ends green: `tsc`, lint, `vitest`, build.

---

## 9. Tests (target)
Unit: role checks, assignment checks, `AnalyticsQuery` Zod validation, safe SQL generation (column allowlist, injection), formula parse/eval, div-by-zero, saved-view persistence, export-with-filters, **unassigned-company access denied**. Playwright: analyst flow (login → 5 cards → open → filter → calc column → save view → export) and admin flow (assign company → appears for user).

---

## 10. Open decisions (need your call — foundational)

1. **Dev database.** No local Postgres; Docker daemon is off. Options: (a) **Prisma Postgres local** (`prisma dev`, real Postgres, zero install) — recommended; (b) Docker Postgres (you start the daemon); (c) SQLite for dev (loses native enums/arrays — schema compromise). Choice affects setup + README.
2. **Execution scope this session.** Plan only (review first), or proceed autonomously through the staged build.

## 11. Deliberate simplifications (hackathon MVP)
- Dev-only **credentials** auth (documented as non-production; real IdP later).
- Saved views **private** to user (model leaves room for shared/team).
- Refresh via **polling** (reuse existing 30s pattern); structured so jobs/webhooks/SSE can replace it.
- Client-side table ops until a company exceeds the `LIMIT` cap; then server-side pagination via the same query object.
