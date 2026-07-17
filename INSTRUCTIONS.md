# Excel Table Studio - Instructions

## Overview
Phase-1 MVP of the AMPace AI-automation project: upload Excel workbooks, auto-detect
tables per sheet, review/correct them in a Next.js UI, export normalized JSON.
Full architecture, parser pipeline, API reference, configuration, security model, and
limitations live in [README.md](README.md) — that file is the canonical reference.

## Technical Architecture
- Next.js 16 (App Router, `src/` dir) · TypeScript · Tailwind 4 · shadcn/ui (Base UI
  variants — components use `render={...}`, **not** `asChild`) · TanStack Table · Zod v4 ·
  SheetJS `xlsx@0.20.3` installed from `https://cdn.sheetjs.com` (npm registry copy is stale).
- Parsing is server-only in `src/lib/excel/`; Zod schemas in `src/lib/schemas/workbook.ts`
  are the source of truth for shared types (TS types inferred via `z.infer`).
- Storage: `.data/workbooks/<uuid>/{original.xlsx, workbook.json}`, swept after 24 h.
- Corrections (PATCH) re-extract structural changes from the stored original file so
  headers/types stay consistent; table ids are preserved for future Databricks mappings
  (`src/lib/adapters/data-source-adapter.ts`).

## Usage Workflows
- `npm run dev` — app on :3000; sample-workbook buttons appear in dev only.
- `npm test` — Vitest parser tests (`src/lib/excel/pipeline.test.ts`).
- `npm run test:e2e` — Playwright (spawns dev server on :3199; Chromium installed via
  `npx playwright install chromium`).
- `npm run fixtures` — regenerate `fixtures/*.xlsx` (required before e2e/samples).

## Dependencies & Setup
```bash
npm install && npm run fixtures && npm run dev
```

## Output Format
Export endpoint returns the full `ParsedWorkbook` JSON (schema in
`src/lib/schemas/workbook.ts`): workbook → sheets → tables → columns/rows, each cell as
`{ raw, normalized, display, formula, type }`.
