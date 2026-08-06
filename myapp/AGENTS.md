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
- Migrations live in `app/study/_sql/0001-0011*.sql` and are applied **manually** in the Supabase SQL editor — there is no migration runner.
- `0011_memory_global_rls.sql` supersedes 0006's permissive "public all" policy on `memories`: global rows (course_id NULL, e.g. name/language preferences) are owned by `user_id` and must satisfy `user_id = auth.uid()`. Do not re-add a blanket `using (true)` policy on `memories`.
- The server Supabase client (`lib/supabase/server.ts`) uses the **anon key + session cookies**, so RLS is enforced on all server-side reads/writes. Always go through `sdb` (`app/study/_lib/supabase-db.ts`); never use the service role key.
- Env keys (names only, in `.env`; no `.env.example` yet): `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Bus tracking adds `NEXT_PUBLIC_TRACCAR_WS_URL` (default `ws://localhost:8082/api/socket`) and `NEXT_PUBLIC_TRACCAR_TOKEN` (user access token for the WebSocket `?token=` auth; set the same names without the `NEXT_PUBLIC_` prefix for the standalone scripts).

## AI layer

- `app/study/_lib/ai/gemini.ts` exports `llm` with a model fallback chain and a `MIN_GAP` (0.35s) rate limit per model — respect it when adding LLM calls. `usageMetadata` (tokens) is currently discarded; `app/study/AGENT_PLAN.md` Task 1 changes that.
- Server actions (`app/study/actions.ts`) are thin wrappers over `llm` + `prompts.ts`; they're plain async functions server-side and can be imported from route handlers.

## Style

- The codebase uses legacy style: `var`, `function` declarations, no semicolon-less formatting — mimic surrounding code, don't "modernize" files you touch.

## Active work

- `app/study/AGENT_PLAN.md` is the approved design + implementation plan (agentic chat: 10 tools, SSE, LLM logging, README/docs). Follow it task-by-task; read the Next.js docs first per the warning above.

# Real-Time Bus Tracking Feature

## Architecture Overview

- Integrate the open-source Traccar Server WebSocket API to receive live bus GPS coordinates.
- Render the data on the Next.js frontend within the student hub portal.

## Data Layer Requirements

- Create a dedicated WebSocket service/hook to manage the connection to the Traccar server.
- Handle connection drops and automatic reconnects gracefully.
- Parse the incoming JSON payloads to extract latitude, longitude, and speed.

## Data layer (implemented)

- `app/study/_lib/traccar/` holds the data layer: `traccar-socket.ts` (connection manager with exponential-backoff reconnects), `parser.ts` (Traccar JSON → lat/lon/speed in km/h), `types.ts`, `config.ts`, and `use-traccar.ts` (React hook). The service works in both browser and Node 21+ (global `WebSocket`).
- Verification: `npm run mock-traccar` runs a local mock Traccar `/api/socket` server; `TRACCAR_TOKEN=... npm run test-traccar` connects and logs parsed positions. `DROP_SECONDS=4,10 npm run mock-traccar` force-drops connections to exercise reconnect.
- The UI (map + custom SVG bus markers) is not built yet.

## UI/UX Requirements

- Design a sleek, minimalist map interface.
- Hide unnecessary map labels or clutter; focus only on the route and the bus markers.
- Create a custom, modern SVG marker for the buses.
