# AMPace — Live Advertising Analytics

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

**Demo logins** (dev-only, password `ampace`): `superadmin@ampace.dev`, `analyst@ampace.dev`,
`viewer@ampace.dev`.

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

## AMPace AI Playbooks

Teach AMPace an analysis once. It compiles that analysis into a governed **playbook**, runs it
across every company you can access, ranks the resulting **opportunities**, opens a ready-made
investigation, and records whether the eventual decision was followed by a better outcome.

**AI interprets; code calculates.** The model only (1) compiles your intent + UI session into a
schema-validated playbook draft and (2) writes a grounded narrative from supplied facts. Every
KPI, condition, impact estimate, confidence, priority, and ranking is deterministic TypeScript.
The model never writes SQL, never picks a table, never sees Databricks credentials, and never
sets a number.

### Workflow

```
Open a company → filter / sort / add a calc column → "Automate this analysis"
  → describe intent, pick scope + schedule
  → AI compiles a reviewable draft (exact thresholds shown)
  → you approve & activate
  → deterministic executor runs across authorized companies
  → ranked Opportunity Inbox → open one → generated investigation
  → mark useful / acted on → observed outcome (labeled non-causal)
```

### Architecture

```
Analytics UI state + user intent
        → AI Playbook Compiler (structured draft only; zodOutputFormat)
        → semantic validation (independent, server-side) → user approval
        → Deterministic Executor  → authorized Databricks reads (read-only)
        → metrics → conditions → impact → confidence → ranking
        → Opportunity Inbox → generated investigation → decision → observed outcome
```

Key modules: `lib/metrics/*` (canonical registry, ratio-of-sums), `lib/playbooks/*` (schemas,
condition-evaluator, impact, scoring, schedule, compatibility, executor, lifecycle),
`lib/ai/*` (env, factory, providers, versioned prompts), `lib/opportunities/*`, `lib/decisions/*`,
`lib/data-sources/*` (Databricks + mock providers), `lib/access/*` (dataset access resolution).

### AI configuration (server-only)

| Var | Meaning |
|---|---|
| `AI_MODE` | `disabled` (clear "not configured", no fake result) · `mock` (offline deterministic compiler/explainer) · `anthropic` (requires key) |
| `ANTHROPIC_API_KEY` | **Add to `.env.local` later.** Read only in server modules; never in a bundle/log/response. Required when `AI_MODE=anthropic` (fails fast if absent — never falls back to mock). |
| `ANTHROPIC_PLAYBOOK_MODEL` / `ANTHROPIC_EXPLAINER_MODEL` | model per task (default `claude-sonnet-5`) |
| `ANTHROPIC_TIMEOUT_MS`, `ANTHROPIC_MAX_RETRIES`, `AI_EXPLANATION_MAX_PER_RUN` | bounded call config |
| `CRON_SECRET` | bearer token for the internal due-run endpoint |
| `PLAYBOOK_DATA_SOURCE` | `databricks` (default) or `mock` (fixtures — offline demo / e2e) |

Structured output uses the installed SDK's `messages.parse({ output_config: { format:
zodOutputFormat(schema) } })`; the result is re-validated locally and then run through an
independent semantic validator (rejects invented fields/formulas, broadened scope, scheduled
absolute dates, SQL-looking text, unknown datasets, etc.).

### Running it

- **Offline demo (no key, no warehouse):** `AI_MODE=mock PLAYBOOK_DATA_SOURCE=mock npm run dev`,
  sign in as the analyst, open a company, **Automate this analysis**, paste the example intent
  (below), review, **Activate & run now**, open **Opportunities**.
- **Manual run of a saved playbook:** the **Run now** button, or `POST /api/playbooks/[id]/run`.
- **Scheduled (external cron) due-run:**
  ```bash
  curl -X POST http://localhost:3000/api/internal/playbooks/run-due \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  Wire this to Vercel Cron / GitHub Actions / Databricks Jobs. The endpoint takes no body — it
  discovers due active playbooks server-side. `nextRunAt` is DST-correct (native `Intl`).
- **Add the real Anthropic key later:** put `ANTHROPIC_API_KEY=...` and `AI_MODE=anthropic` in
  `.env.local` (gitignored). No code change; the mock path stays for tests.

Example intent:

> Find high-spend companies whose ROAS has fallen by at least 15 percent compared with the
> previous period. Only qualify companies with at least 10000 in current spend. Prioritize the
> largest estimated revenue gap using the previous period ROAS as the baseline.

### Determinism & scoring

- **Ratio of sums** (§`lib/metrics/aggregate.ts`): period CPC/ROAS/CVR are recomputed from summed
  components, never averaged from daily ratios. Zero denominator → `null`.
- **Impact** `PRIOR_PERIOD_ROAS_REVENUE_GAP` = `max(0, (compRev/compSpend) × curSpend − curRev)`;
  `PROFIT_DELTA` = `max(0, −((curRev−curSpend) − (compRev−compSpend)))`.
- **Confidence** 0–100 = field completeness 35% + current coverage 25% + comparison coverage 20% +
  freshness 20% (renormalized when a component is N/A). Labels: ≥80 High, ≥55 Medium, else Low.
- **Priority** 0–100 = normalized impact 45% + magnitude 30% + confidence 25% (renormalized when no
  monetary impact). Severity: ≥70 High, ≥40 Medium, else Low.
- **Formulas** reuse the existing safe engine (`lib/excel/formula.ts`): `+ - * /`, parens,
  `[Bracketed]` refs; no `eval`. AI may only preserve calc columns already in the source analysis.
- **Outcomes** compare an equal-length baseline before the action with the observation window
  after it, and always display: *"Observed after action; this does not establish causation."*

### AI Playbooks API

```
GET  /api/ai/status                              { mode, configured, modelLabel }  (never the key)
POST /api/playbooks/compile                      compile only — never activates
GET/POST /api/playbooks                          list / create (optional activate + runNow)
GET/PATCH/DELETE /api/playbooks/[id]             read / edit-safe-fields / archive-or-delete
POST /api/playbooks/[id]/activate | /pause | /run
GET  /api/playbooks/[id]/compatibility
GET  /api/playbook-runs · /api/playbook-runs/[id]
GET  /api/opportunities · GET/PATCH /api/opportunities/[id]
POST /api/opportunities/[id]/decisions · /evaluate · GET /investigation
POST /api/internal/playbooks/run-due             constant-time CRON_SECRET; no user body
```

### Persistence (hackathon phase)

Playbooks/runs/opportunities/decisions/outcomes are stored as atomic JSON under
`.data/ai-playbooks/<kind>/<hashed-owner>/<id>.json` (server-generated ids, path-traversal-proof,
temp-file+rename, in-process mutex, Zod-validated on read). **Not for horizontally-scaled/
serverless production** — the repository interfaces are swappable for Postgres later.

## Known limitations

- **AI Playbooks:** local-JSON persistence (single-instance only); synchronous run execution
  (structured so a queue can replace it); single-tenant dataset access (every authenticated
  non-viewer can access all `excel_company_*` tables — swap `DatasetAccessProvider` for real
  per-user assignment). Live Anthropic and live Databricks paths compile and are wired but were
  verified with mock providers this session (no key / warehouse required to demo).
- Dev-credentials auth (documented above) — not for production.
- Datasets are read live per request/poll; no server-side caching yet. Row pulls are capped
  (`EXCEL_PREVIEW_ROWS`, default 1000) — large tables need server-side pagination (the query
  shape already supports it).
- Non-canonical / extra company dimensions (Campaign, Device, …) are not yet surfaced; only the 9
  canonical metrics are shown.
