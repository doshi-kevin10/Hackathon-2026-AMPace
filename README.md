# AMPulse — Live Advertising Analytics

A login-gated analytics workspace where **Databricks is the source of truth**. Users sign in,
browse the advertising datasets in the workspace, and analyze live daily metrics — sort, search,
date-filter — in a spreadsheet-style grid that auto-refreshes as the Databricks data changes.

> This is the pivoted product. It grew out of an Excel-parser prototype; that ingestion path has
> been removed from the app (Excel is no longer an input). See `REFACTOR_PLAN.md` for the full
> intended platform and which parts of it this build intentionally defers.

## Quick start

```bash
npm install

# Databricks (same vars the databricks CLI uses)
export DATABRICKS_HOST="https://<workspace>.cloud.databricks.com"
export DATABRICKS_TOKEN="<pat>"
# optional: DATABRICKS_WAREHOUSE_ID, DATABRICKS_CATALOG, DATABRICKS_SCHEMA
# recommended in any shared/prod use:
export AUTH_SECRET="$(openssl rand -hex 32)"

npm run dev            # http://localhost:3000  → redirects to /login
```

**Demo logins** (dev-only, password `ampulse`): `superadmin@ampulse.dev`, `analyst@ampulse.dev`,
`viewer@ampulse.dev`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build + serve |
| `npm test` | Vitest unit tests |
| `E2E_PORT=3000 npm run test:e2e` | Playwright (point at a running server; Next allows one dev instance per project) |
| `npm run lint` | ESLint |

## Architecture

```
Browser (signed-cookie session)
  │  fetch /api/datasets, /api/datasets/[name]   (never SQL)
  ▼
Next.js App Router
  ├── middleware.ts        auth gate — unauth pages → /login, unauth APIs → 401
  ├── lib/auth/*           dev credentials + jose-signed session (JWT cookie)
  └── lib/databricks/*     read-only analytics over the approved schema
                             executeStatement → Databricks SQL Statement Execution API
```

**Data ownership.** Databricks holds the analytics data. The app holds only trivial metadata (dev
users in config) — **no PostgreSQL in this build** (the full spec's Postgres/Prisma layer is
deferred; see `REFACTOR_PLAN.md`).

## Authentication

- `middleware.ts` gates every route: unauthenticated page requests redirect to `/login`, API
  requests get `401`. Data API handlers **also** re-check the session server-side (defense in
  depth — authorization never depends on hidden UI).
- Sessions are `jose`-signed JWTs in an `httpOnly`, `sameSite=lax`, `secure`-in-prod cookie
  (8h). The edge middleware only *verifies* JWTs (no `node:crypto`); password checks
  (`node:crypto` scrypt, constant-time) live in a node-only module (`lib/auth/credentials.ts`).
- **Dev credentials only.** Demo users live in `src/lib/auth/config.ts` as plaintext demo
  passwords. This is a development login and **must not be used in production** — swap for
  Auth.js/Clerk + a real user store. Set `AUTH_SECRET` outside local dev.

Roles (`SUPER_ADMIN`/`ADMIN`/`ANALYST`/`VIEWER`) exist on the session for future gating; the
role-based admin UIs and per-company assignments from the full spec are not built in this phase.

## Datasets & analytics

- **Datasets = approved Databricks tables.** The workspace lists tables in the approved schema
  (`DATABRICKS_CATALOG.DATABRICKS_SCHEMA`, default `dev_catalog_for_individual_use.kevin_dev`)
  whose names carry the managed `excel_` prefix. Each becomes a card on `/` and opens at
  `/datasets/[name]`.
- **Canonical columns** shown for every dataset: **Date, Day, Total Adspend, Clicks, CPC, Revenue,
  Conversions, ROAS, CVR** (defined once in `lib/databricks/sync.ts` → `DB_COLUMNS`).
- **Live grid** (`components/tables/data-table.tsx`, TanStack Table): sort, global search, column
  visibility, sticky header, row numbers, horizontal scroll. Plus a client-side **date-range
  filter** on the dataset page.
- **Live refresh:** the dataset page re-pulls from Databricks every 30s (with request
  cancellation), showing a live indicator, last-refreshed time, and latest data date. No page
  reloads. Structured so polling can later be replaced by jobs/webhooks/SSE.

## API routes

| Route | Purpose |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | session cookie in/out |
| `GET /api/me` | current session user |
| `GET /api/datasets` | list approved datasets (auth required) |
| `GET /api/datasets/[name]` | live canonical rows for one dataset (auth + name allowlist) |

Removed: all `/api/workbooks/**` and `/api/samples` (Excel ingestion) — now `404`.

## Security

- Server-side auth on every route (middleware) **and** in each data handler.
- The frontend never sends SQL or a freely-chosen table name — the dataset name is validated
  against `^[a-z0-9_]+$` **and** the managed `excel_` prefix, then wrapped in the fixed
  `catalog.schema` (no catalog/schema traversal). Unapproved names (e.g. `path_metrics`) → `404`.
- Read-only analytics: the app never writes to Databricks tables in this flow. String literals in
  any generated SQL are hardened (backslash + quote escaping; see `lib/databricks/sync.ts`).
- No Databricks credentials reach the browser (server-only modules).

## Configuration

Env vars (`src/lib/config.ts` + Databricks/auth): `DATABRICKS_HOST`, `DATABRICKS_TOKEN`,
`DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_CATALOG` (default `dev_catalog_for_individual_use`),
`DATABRICKS_SCHEMA` (default `kevin_dev`), `AUTH_SECRET`, `EXCEL_PREVIEW_ROWS` (row cap per pull,
default 1000).

## What's reused / removed / deferred

- **Reused:** TanStack data grid, the safe formula engine (`lib/excel/formula.ts`), canonical
  metric definitions, the Databricks SQL client, safe-SQL helpers, Zod validation.
- **Removed from the app:** Excel upload page & APIs, workbook parsing/detection/correction UI,
  Excel→Databricks sync UI, temporary upload storage, sample fixtures route.
- **Deferred (in `REFACTOR_PLAN.md`, not this build):** PostgreSQL/Prisma, admin user/company/
  assignment CRUD, saved views, calculated-column UI, Excel export. The formula engine and the
  Excel parsing lib remain on disk (unlinked) for those follow-ups.

## Known limitations

- Dev-credentials auth (documented above) — not for production.
- Datasets are read live per request/poll; no server-side caching yet. Row pulls are capped
  (`EXCEL_PREVIEW_ROWS`, default 1000) — large tables need server-side pagination (the query
  shape already supports it).
- Non-canonical / extra company dimensions (Campaign, Device, …) are not yet surfaced; only the 9
  canonical metrics are shown.
