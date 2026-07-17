# AMPace AI Playbooks — Implementation Plan

> Source of truth is the checked-out code, not this doc. Verified against the repo on 2026-07-16.

## Verified current architecture

- **Framework**: Next.js 16.2.10 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind 4, Zod 4.4.3.
- **Anthropic SDK**: `@anthropic-ai/sdk@0.111.0`. Structured output via `messages.parse({ output_config: { format: zodOutputFormat(schema) } })` → `message.parsed_output` (helper: `@anthropic-ai/sdk/helpers/zod`, uses `zod/v4` which is the same package). Existing chat route uses `messages.create` with `output_config: { effort }` and model `claude-opus-4-8`.
- **Auth**: JWT session cookie (`ampace_session`) via `jose`. `getSessionUser()` / `requireUser()` in `src/lib/auth/server.ts`. Roles: `SUPER_ADMIN | ADMIN | ANALYST | VIEWER` (`src/lib/auth/config.ts`, dev users only). `src/middleware.ts` guards everything except `/login` + auth routes.
- **Databricks**: REST Statement Execution client (`src/lib/databricks/client.ts`, server-only, token from env, `databricksConfigured()`). Analytics layer (`src/lib/databricks/analytics.ts`) allowlists tables by `excel_company_` prefix + `^[a-z0-9_]+$`, `isValidDatasetName()`, `listDatasets()`, `getDatasetRows()`. Canonical 9-col schema in `sync.ts` `DB_COLUMNS` (Date, Day, Total_Adspend, Clicks, CPC, Revenue, Conversions, ROAS, CVR). **Reads only** for this feature; writes exist only in sync.ts (not used by playbooks).
- **Formula engine**: `src/lib/excel/formula.ts` — pure, eval-free tokenizer/parser/evaluator (`+ - * /`, parens, `[Bracketed]` refs). Wrapped by `src/lib/formula/calc-columns.ts` (`CalcColumnSpec {id,name,formula,format}`, `validateCalcColumn`, `applyCalcColumns`). **Reuse this — do not write a second evaluator.**
- **Metrics**: `src/lib/analytics/kpi.ts` `computeKpiTotals` already does ratio-of-sums (CPC/ROAS/CVR/CPA from summed components). Extend into a canonical registry; keep behavior.
- **Types**: `src/lib/schemas/workbook.ts` — `CellValue`, `ParsedColumn`, `ColumnType`. `LiveTable` (rows keyed by `col_N`) from `sync.ts`.
- **UI**: dataset page `src/app/datasets/[name]/page.tsx` → `DatasetView` (client). Date filter (`from`/`to`), calc columns (sessionStorage), KPIs, `DataTable` (TanStack, local sorting/filter/visibility state), `TableAnalytics` charts. Company = dataset (one table per company).
- **Local JSON stores**: `src/lib/goals/goal-store.ts`, `src/lib/alerts/alert-store.ts`, `src/lib/storage/workbooks.ts` under `.data/` (gitignored). Pattern to follow for playbook persistence.
- **Tests**: Vitest (`src/**/*.test.ts`, node env, `@` alias). Playwright (`e2e/`, dev server on 3199). Baseline: **39 tests pass, tsc clean, lint 0 errors / 2 pre-existing warnings, build ok**.

## Reused (extended, not duplicated)

- `src/lib/excel/formula.ts` + `src/lib/formula/calc-columns.ts` — formula parse/validate/evaluate.
- `src/lib/auth/server.ts` + `config.ts` — `requireUser`, roles.
- `src/lib/databricks/client.ts` — `executeStatement`, `databricksConfigured`, `DatabricksError`.
- `src/lib/databricks/analytics.ts` — dataset allowlist, `listDatasets`, `isValidDatasetName`, `DB_COLUMNS`.
- `src/lib/analytics/kpi.ts` — ratio-of-sums semantics (canonical-registry source).
- `@anthropic-ai/sdk` client pattern from `src/app/api/chat/route.ts`.
- `.data/`-based JSON persistence pattern.
- shadcn/base-ui components in `src/components/ui/*`.

## Untouched

Excel upload/parse pipeline, `sync.ts` write path, goals, alerts/Slack, news, chatbot, existing dataset analytics UI behavior, KPI display numbers.

## Target architecture

```
Analytics UI state + user intent
      → AI Playbook Compiler (structured draft only; mock or Anthropic)
      → user approval
      → Deterministic Executor (authorized Databricks reads)
      → metrics → conditions → impact → confidence → ranking
      → Opportunity Inbox → generated investigation → decision → observed outcome
```

New code under `src/lib/{metrics,analysis-session,playbooks,opportunities,decisions,access,ai,data-sources}`, routes under `src/app/api/{ai,playbooks,playbook-runs,opportunities,internal}`, pages `src/app/{playbooks,opportunities}`, components `src/components/{playbooks,opportunities}`. Persistence `.data/ai-playbooks/`.

## Ordered phases

0 audit+docs · 1 schemas+pure engine · 2 repos+access · 3 session capture · 4 AI compiler · 5 wizard+lifecycle · 6 executor · 7 opportunities+investigation · 8 decisions+outcomes · 9 scheduling · 10 e2e+docs. (Full detail in the master prompt §24.)

## Risks & mitigations

- **Ratio-of-sums correctness** → single canonical registry + `aggregate.ts`, tested against `kpi.ts` behavior.
- **Prompt injection / model over-reach** → strict `zodOutputFormat` + independent server-side semantic validator (never trust model scope/fields/formulas).
- **Live table pull is row-capped (1000) & unaggregated** → executor uses its own bounded aggregate query (current + comparison periods) rather than the UI pull path.
- **No DB** → atomic FS repositories behind interfaces, swappable later.
- **AI key absent** → mock provider + `AI_MODE`; never fall back to mock in production.

## Non-goals (this phase)

Postgres/Prisma, super-admin/org system, arbitrary SQL by model, Databricks writes, Slack/news as primary, RAG/vector DB, causal claims, auto budget actions, Excel-upload flow, full workflow builder, websockets, distributed queue.
