# Architecture Decision Records — AI Playbooks

## ADR-1: AI compiles JSON, not SQL
The compiler returns a Zod-validated playbook draft (discriminated union `ready | needs_clarification`) via `zodOutputFormat`. It never emits SQL, table names, or executable code. Rationale: deterministic, auditable, injection-resistant; the model interprets intent, code executes it.

## ADR-2: Deterministic code owns all numbers
Every KPI, condition evaluation, impact estimate, confidence, priority, and ranking is computed by pure TS. AI may summarize supplied facts but cannot create/alter a number. Rationale: correctness and trust; matches existing `kpi.ts` ratio-of-sums.

## ADR-3: Persistence = atomic filesystem JSON under `.data/ai-playbooks/`
No DB in the repo, so we follow the existing goal/alert-store pattern but harden it: server-generated ids, path-traversal guards, temp-file + rename atomic writes, an in-process mutex, and Zod validation on read. Behind repository interfaces so Postgres can replace them. Rationale: matches hackathon scope; §16 of spec.

## ADR-4: Dataset access resolved server-side at execution time
`DatasetAccessProvider` wraps `listDatasets()` (the existing allowlist) + session role. Scope (`CURRENT/SELECTED/ALL_ACCESSIBLE`) is intersected with live access at compile, activate, and every run; model-supplied ids are re-checked. Revoked access → dataset skipped + historical detail denied. Rationale: §4.5, §11. MVP: all authenticated non-viewer users can access all `excel_company_*` datasets (single-tenant demo); interface leaves room for per-user assignment later.

## ADR-5: Metric aggregation = ratio of sums
Additive metrics (adspend, clicks, revenue, conversions) are summed; ratios (CPC, ROAS, CVR) are recomputed from summed components; zero denominator → `null`. Calc columns: period value = evaluate formula over summed base components when the formula is affine over additive inputs (e.g. Profit = Revenue − Adspend); reject otherwise in v1. Rationale: §4.6, avoids average-of-averages.

## ADR-6: Opportunity dedup via fingerprint
Fingerprint = sha256 of canonical serialization of `owner + playbookId + datasetId + normalized trigger definition`. Open opp with same fingerprint within dedupe window → update (append occurrence, refresh evidence, keep firstDetectedAt). Resolved+recurs → new. Dismissed → suppressed for window. Rationale: §15, prevents alert spam.

## ADR-7: Scheduler = external-cron pull, not setInterval
`nextRunAt` persisted per playbook; `POST /api/internal/playbooks/run-due` (constant-time `CRON_SECRET` check) discovers due active playbooks and runs them. No timers in Next. Idempotency key = `playbookId + revision + scheduledFor`. Rationale: §18, serverless-safe.

## ADR-8: AI provider fallback
`AI_MODE = disabled | mock | anthropic`. disabled → explicit "not configured" (no fake result). mock → deterministic fixtures (dev-labeled). anthropic → requires key, fails fast if missing. **Never** silently fall back anthropic→mock in production. Rationale: §9.1.

## ADR-9: Executor runs synchronously within a bounded timeout
Manual/scheduled runs execute inline (bounded concurrency 2–3 datasets) and return a durable run record. Structured behind `PlaybookRunService` so a queue can replace the invocation. Rationale: §17, hackathon scope.

## ADR-10: Reuse the existing formula engine and canonical schema
No second expression evaluator; no duplicate metric definitions. The canonical registry is the single source, and `applyCalcColumns` evaluates calc columns. Rationale: §3, §31.
