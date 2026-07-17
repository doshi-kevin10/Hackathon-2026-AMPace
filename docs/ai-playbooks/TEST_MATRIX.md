# Test Matrix — AI Playbooks

Legend: U=unit (vitest), I=integration (service/route), E=Playwright e2e, M=manual. Status: ☐ todo, ☑ done.

## Pure engine (Phase 1)
| # | Criterion | Kind | File | Status |
|---|-----------|------|------|--------|
| 1 | Canonical metric registry shape | U | metrics/canonical-registry.test.ts | ☐ |
| 2 | Additive aggregation (sum) | U | metrics/aggregate.test.ts | ☐ |
| 3 | Ratio-of-sums CPC | U | metrics/aggregate.test.ts | ☐ |
| 4 | Ratio-of-sums ROAS | U | metrics/aggregate.test.ts | ☐ |
| 5 | Ratio-of-sums CVR | U | metrics/aggregate.test.ts | ☐ |
| 6 | Zero denominator → null | U | metrics/aggregate.test.ts | ☐ |
| 7 | Date-window resolution (rolling/calendar/absolute) | U | playbooks/schedule.test.ts | ☐ |
| 8 | Previous-period resolution | U | playbooks/schedule.test.ts | ☐ |
| 9 | DST-safe next-run calc | U | playbooks/schedule.test.ts | ☐ |
| 10 | Analysis event reducer | U | analysis-session/reducer.test.ts | ☐ |
| 11 | Event compaction | U | analysis-session/compact-events.test.ts | ☐ |
| 12 | Sanitization + size limits | U | analysis-session/sanitize.test.ts | ☐ |
| 13 | Filter operator/type validation | U | playbooks/semantic-validator.test.ts | ☐ |
| 14 | Formula reuse + validation | U | playbooks/semantic-validator.test.ts | ☐ |
| 15 | Compiler output schema | U | ai/compiler.test.ts | ☐ |
| 16 | Semantic validator rejects invented field | U | playbooks/semantic-validator.test.ts | ☐ |
| 17 | Semantic validator rejects broadened scope | U | playbooks/semantic-validator.test.ts | ☐ |
| 18 | Semantic validator rejects invented formula | U | playbooks/semantic-validator.test.ts | ☐ |
| 19 | Semantic validator rejects scheduled absolute dates | U | playbooks/semantic-validator.test.ts | ☐ |
| 20 | Condition evaluation — every operator | U | playbooks/condition-evaluator.test.ts | ☐ |
| 21 | Percent change with zero comparison → null | U | playbooks/observations.test.ts | ☐ |
| 22 | Qualifier vs trigger behavior | U | playbooks/condition-evaluator.test.ts | ☐ |
| 23 | Revenue-gap impact formula | U | playbooks/impact.test.ts | ☐ |
| 24 | Profit-delta impact formula | U | playbooks/impact.test.ts | ☐ |
| 25 | Confidence components | U | playbooks/confidence.test.ts | ☐ |
| 26 | Priority scoring with impact | U | playbooks/priority.test.ts | ☐ |
| 27 | Priority scoring without impact | U | playbooks/priority.test.ts | ☐ |
| 28 | Compatibility missing field | U | playbooks/compatibility.test.ts | ☐ |
| 29 | Opportunity fingerprint stability | U | opportunities/dedupe.test.ts | ☐ |
| 30 | Opportunity dedup | U/I | opportunities/dedupe.test.ts | ☐ |
| 31 | Run idempotency | I | playbooks/run-service.test.ts | ☐ |
| 32 | Overlapping run prevention | I | playbooks/run-service.test.ts | ☐ |
| 33 | Atomic repository writes | U | playbooks/repositories.test.ts | ☐ |
| 34 | Path traversal rejection | U | playbooks/repositories.test.ts | ☐ |
| 35 | Ownership checks | I | playbooks/repositories.test.ts | ☐ |
| 36 | Dataset-access checks | U/I | access/dataset-access.test.ts | ☐ |
| 37 | Outcome period calculation | U | decisions/outcome-evaluator.test.ts | ☐ |
| 38 | Outcome not-ready behavior | U | decisions/outcome-evaluator.test.ts | ☐ |
| 39 | Prompt-injection fixture ignored | U | ai/compiler.test.ts | ☐ |
| 40 | AI invalid-output handling | U | ai/compiler.test.ts | ☐ |

## Integration (Phase 4–9)
Compile→draft; ambiguous→clarification; draft→activate→run→opportunity; mixed compatible/incompatible; partial provider failure; repeated idempotency key; dynamic all-accessible after access change; AI explanation failure fallback; decision→outcome not ready; decision→eligible outcome; unauthorized opp read denied; invalid cron secret denied; same scheduled run twice.

## Playwright (Phase 10)
Analyst full workflow (open dataset → calc column → automate → compile mock → review → activate+run → inbox → opportunity → investigation → mark acted on). Authorization (viewer cannot create; unauthorized dataset URL denied). Resilience (AI disabled → clear UI; one dataset fails → partial + others visible).
