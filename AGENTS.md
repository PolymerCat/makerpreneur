# Makerpreneur Study Hub

Agent guide for this repo. Read before writing code.

## This is NOT the Next.js you know

Next.js 16.2.10 (App Router) with breaking changes: APIs, conventions, and file structure may differ from training data. Read the relevant guide in `myapp/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Layout

- All application code lives under `myapp/` (package.json, app/, lib/, scripts/). The repo root only holds docs and `myapp/`.
- The study platform (RAG chat, agent, flashcards, quizzes, exam PDFs, planner) lives under `myapp/app/study/`. The AI layer is in `myapp/app/study/_lib/ai/` (agent.ts, tools.ts, retrieve.ts, logger.ts, gemini.ts).

## Code style

The codebase uses legacy style: `var`, `function` declarations, no semicolon-less formatting. Mimic surrounding code; do not modernize files you touch.

## Commands

Run from `myapp/`:

- `npm run dev` / `npm run build` / `npm run lint` (plain `eslint`)
- `npm test` runs vitest only on `app/study/_lib/ai/`
- There is no typecheck script; typecheck with `npx tsc --noEmit`

## Database

- Supabase (Postgres + pgvector + RLS). Migrations live in `myapp/app/study/_sql/0001-0010*.sql` and are applied manually in the Supabase SQL editor; there is no migration runner.
- `0009_subjects_ownership.sql` renamed `courses` to `subjects` with a `created_by` owner and owner-scoped RLS on every table. Code uses `subjects`; FK columns are still named `course_id` everywhere. Do not rename them.
- The server Supabase client (`myapp/lib/supabase/server.ts`) uses the anon key + session cookies, so RLS is enforced on all server reads/writes. Always go through `sdb` (`myapp/app/study/_lib/supabase-db.ts`); never use the service role key.

## Env

Keys (names only, in `.env`, gitignored; `.env.example` has no values): `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
