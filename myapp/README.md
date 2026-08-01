# Makerpreneur Study Hub

A Next.js 16 study platform with RAG chat, flashcards, quizzes, exam PDF generation, a smart study planner, and Supabase pgvector-backed memory. All app code lives under `app/study/`.

## Tech Stack

- **Framework**: Next.js 16.2.10 (App Router, React 19)
- **AI**: Google Gemini via `@google/genai` — RAG chat with streaming, topic sequencing, exam paper generation
- **Database**: Supabase (Postgres + pgvector) with Row-Level Security on every table
- **Styling**: Tailwind CSS v4
- **Markdown + Math**: `marked` v18 + KaTeX for inline and display math rendering

## Key Features

- **RAG Chat** — ask questions about uploaded study materials; the system retrieves relevant chunks, feeds them to Gemini, and streams answers back with a typewriter effect. Images attach to messages, get auto-captioned, and can be re-read on demand.
- **Flashcards & Quizzes** — generate from materials or custom lists; spaced repetition via manual review.
- **Exam PDF Generation** — produce practice exams from your uploaded materials with configurable question types.
- **Study Planner** — register all your exams, rate topic difficulty, and get an auto-generated schedule that accounts for exam spacing, consecutive exam clusters, and revision buffers.
- **Memory** — the chat system extracts and stores important facts from conversations so later questions can reference them.

## Project Structure

```
app/
  study/
    chat/          — RAG chat page
    planner/       — unified study planner (exams + schedule)
    path/          — redirects to planner
    materials/     — upload and manage study materials
    flashcards/    — flashcard deck management
    quizzes/       — quiz generation and taking
    summaries/     — material summaries
    memory/        — chat memory review
    analytics/     — study analytics
    papers/        — generated exam papers
    _lib/          — db layer, AI helpers, types, prompts
    _sql/          — Supabase migrations (run manually in the SQL editor)
    actions.ts     — server actions (LLM calls, file ops)
  auth/            — sign in / sign up pages
  profile/         — user profile

docs/
  superpowers/     — design specs and implementation plans
```

## Setup

### 1. Environment variables

Create `.env` in the project root with these keys (no `.env.example` yet):

```
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Database setup

Migrations live in `app/study/_sql/` (numbered `0001` through `0010`). Apply them manually in the Supabase SQL editor — there is no migration runner. The order matters: `0001` through `0010` must run sequentially.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint (note: the repo has pre-existing `no-var` errors across all files — lint is effectively broken before any feature work) |

## Supabase RLS

The server Supabase client (`lib/supabase/server.ts`) uses the anon key + session cookies, so RLS is enforced on all server-side reads and writes. Always go through `db` (`app/study/_lib/supabase-db.ts`); never use the service role key.

## Design & Plans

Design specs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.
