<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Makerpreneur Study Hub

Next.js 16.2.10 App Router study platform: RAG chat (Gemini), flashcards, quizzes, exam PDF generation, study planner, Supabase (pgvector) + RLS. All app code lives under `app/study/`.

## Commands

- `npm run dev` / `npm run build` / `npm run lint` (plain `eslint`). There is **no test or typecheck script** — don't assume `npm test` exists; typecheck with `npx tsc --noEmit`.
- Commits happen per task; current branch is `merge-study-planner-NEW-UI`.

## Schema gotchas

- `DATABASE_SCHEMA.MD` (local, gitignored) is the authoritative table/column reference; consult it before writing queries.
- `0009_subjects_ownership.sql` renamed `courses` → `subjects` (with `created_by` owner + owner-scoped RLS on every table). **Code uses `subjects`; FK columns are still named `course_id`** everywhere — don't "fix" them.
- Migrations live in `app/study/_sql/0001-0010*.sql` and are applied **manually** in the Supabase SQL editor — there is no migration runner.
- The server Supabase client (`lib/supabase/server.ts`) uses the **anon key + session cookies**, so RLS is enforced on all server-side reads/writes. Always go through `sdb` (`app/study/_lib/supabase-db.ts`); never use the service role key.
- Env keys (names only, in `.env`; no `.env.example` yet): `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## AI layer

- `app/study/_lib/ai/gemini.ts` exports `llm` with a model fallback chain and a `MIN_GAP` (0.35s) rate limit per model — respect it when adding LLM calls. `usageMetadata` (tokens) is currently discarded; `app/study/AGENT_PLAN.md` Task 1 changes that.
- Server actions (`app/study/actions.ts`) are thin wrappers over `llm` + `prompts.ts`; they're plain async functions server-side and can be imported from route handlers.

## Style

- The codebase uses legacy style: `var`, `function` declarations, no semicolon-less formatting — mimic surrounding code, don't "modernize" files you touch.

## Active work

- `app/study/AGENT_PLAN.md` is the approved design + implementation plan (agentic chat: 10 tools, SSE, LLM logging, README/docs). Follow it task-by-task; read the Next.js docs first per the warning above.
