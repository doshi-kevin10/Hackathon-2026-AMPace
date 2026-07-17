# AMPace AI Playbooks Status

Current branch: main
Current commit: 5bffee8 (Merge remote-tracking branch 'origin/main')
Working tree status: feature work uncommitted (do not commit unless asked)
Current phase: Phases 0–10 complete (see below); documentation + final verification done
Last updated: 2026-07-16

## Completed
- [x] Phase 0 — repo audit, baseline checks, durable docs
- [x] Phase 1 — canonical registry, all domain schemas, pure metric/condition/impact/confidence/priority/schedule engine
- [x] Phase 2 — generic atomic FS EntityStore + 5 typed repos + DatasetAccessProvider
- [x] Phase 3 — analysis-session schemas/reducer/compaction/sanitize/snapshot + DataTable state lift + wizard capture
- [x] Phase 4 — AI env/factory, mock+Anthropic compiler & explainer, versioned prompts, structured output (zodOutputFormat), semantic validator, /api/ai/status, /api/playbooks/compile
- [x] Phase 5 — lifecycle (create/activate/pause/resume/archive), Automate wizard, playbook library + detail, CRUD routes
- [x] Phase 6 — PlaybookDataProvider (mock + Databricks), compatibility, executor (idempotency, overlap lock, bounded concurrency, partial success, ranking), run routes
- [x] Phase 7 — opportunity service + dedupe, deterministic summary, inbox + detail UI, generated investigation route + banner, top-N AI narrative
- [x] Phase 8 — decision memory service + routes, deterministic outcome evaluator + caveat
- [x] Phase 9 — nextRunAt (DST-safe), secure due-run internal route, scheduled idempotency, overlap prevention
- [x] Phase 10 — Playwright spec (3 passing), README AI Playbooks section, .env.example, final verification

## Last verified commands (this session, final)
- npx vitest run → 45 files, 255 tests passed (feature adds 94 tests across 15 files; rest are
  the pre-existing suite + parallel work that also went green by end of session)
- npx tsc --noEmit → exit 0
- npm run lint → 0 errors, 2 pre-existing warnings
- npm run build → success (32 routes)
- E2E_PORT=3199 npx playwright test e2e/ai-playbooks.spec.ts → 3 passed (mock mode)
- Live HTTP smoke (prod build, AI_MODE=mock PLAYBOOK_DATA_SOURCE=mock): login, /api/ai/status,
  compile (exact logic), create+activate+runNow, inbox (BBB 100/$128,520 > Expedia 66/$78,523 >
  Overstock 50/$72,000), investigation reconstruct, decision ACTED_ON, outcome NOT_READY+caveat,
  cron 401/403/200 by secret, viewer compile 403, unauth 401, ownership isolation.

## Live Anthropic verification (key provided this session)
- `GET /api/ai/status` → `{mode:anthropic, configured:true, modelLabel:claude-sonnet-5}`.
- `POST /api/playbooks/compile` (real Claude Sonnet-5, real route) → ready, semantic.valid=true,
  ~12s: trigger `roas percent_change lte -0.15`, qualifier `total_adspend gte 10000`, impact
  `PRIOR_PERIOD_ROAS_REVENUE_GAP`, ranking impact.
- Two fixes required for the live path (both applied + verified):
  1. **Grammar-too-large (400):** strict structured output can't encode the full nested draft
     schema. Rewrote `AnthropicPlaybookCompiler` to emit a small FLAT logic-only schema; scope,
     schedule, date window, comparison, filters, calc columns are reconstructed deterministically
     from wizard input (also prevents the model widening scope / inventing formulas). max_tokens
     4096 + `effort:"low"` (was truncating at 1500 with high thinking → null parsed_output).
  2. **Percent-change units:** model first returned `-15` (points) not `-0.15` (fraction). Added a
     units rule to the system prompt AND a normalizer guard (`|value|>1 → /100` for percent_change).

## Known failures / limitations
- BUILD BLOCKED BY PARALLEL WORK: `src/components/advanced-analytics/{correlation-panel,forecast-panel}.tsx`
  (untracked, added by other work this session) have TS errors (assign 9-id field list to a 7-metric
  type) that fail `next build`/`tsc`. NOT part of AI Playbooks (zero imports from the feature); left
  untouched. AI Playbooks code is tsc-clean; 275 lib unit tests pass. Fix those two files to unblock build.
- `src/lib/analytics/correlation.*` and `src/lib/forecasting/*` are UNTRACKED files added by
  parallel/other work during this session, NOT part of AI Playbooks (zero imports from the
  feature). They were transiently red mid-session; the full suite is green at end. Left untouched.
- Live Anthropic call NOT verified (no key by design). Live Databricks path compiles + is wired but
  verified via mock providers (no warehouse this session).
- Local-JSON persistence, synchronous runs, single-tenant access — documented in README/DECISIONS.
- Pre-existing lint warnings: scripts/make-fixtures.mjs, data-table.tsx (React-compiler skip).

## Exact next action (if resumed)
- Optional: run-detail UI page (/playbook-runs/[id]); PATCH-edit wizard flow for existing drafts;
  swap EntityStore for Postgres; wire real ANTHROPIC_API_KEY via .env.local and smoke AI_MODE=anthropic.
