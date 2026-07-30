# Study Module — Architecture Ground Truth

This document is the **single source of truth** for how the AI study features are
architected. It is not a step-by-step build plan. It describes the system as it
should exist: the directories, the data model, the pipelines, and *why* each
decision was made. Read it top to bottom once; every section builds on the last.

**Confirmed constraints (from brainstorming):**

| Decision | Choice | Why |
|---|---|---|
| LLM | Google Gemini 2.5 Flash | Free tier, 1M-token context, strong Bahasa Melayu support |
| Backend | Supabase (auth + Postgres + storage + pgvector) | One service, free tier, SQL |
| Retrieval | Full RAG: embeddings + pgvector | Industry-standard pipeline (user requirement) |
| Past year papers | Curated/seeded by admin, not user-uploaded | Quality control, less CRUD surface |
| Flashcards | In-app digital cards with SM-2 spaced repetition | No Anki file export needed |
| Languages | BM ↔ English: output toggle + material translation + i18n UI | User requirement |
| Scale target | Demo / competition entry | Free tiers everywhere, no queues |

---

## 1. The Mental Model

All nine features reduce to two kinds of work:

```
┌─────────────────────────────────────────────────────────────────┐
│  KIND 1 — AI PIPELINE  (features 1,2,3,4,5,9)                   │
│  "Build a prompt from stored data → call Gemini → store result" │
│                                                                 │
│  KIND 2 — CRUD  (features 6,7,8)                                │
│  "Rows in Postgres, rendered as lists/calendars"                │
└─────────────────────────────────────────────────────────────────┘
```

If you understand the AI pipeline deeply, you understand 80% of this system.
The CRUD features are ordinary Next.js + Supabase work.

---

## 2. System Architecture Diagram

```
                          ┌─────────────────────────────┐
                          │        BROWSER (React)       │
                          │  study/* pages, chat UI,     │
                          │  flashcard UI, planner UI    │
                          └──────────────┬──────────────┘
                                         │ fetch
                          ┌──────────────▼──────────────┐
                          │   NEXT.JS ROUTE HANDLERS     │   app/api/*
                          │   (server-only, hold the     │
                          │    Gemini API key)           │
                          └───┬──────────┬──────────┬───┘
                              │          │          │
              ┌───────────────▼──┐   ┌───▼───────┐  │
              │    SUPABASE      │   │  GEMINI   │  │
              │  Auth            │   │  2.5 Flash│  │
              │  Postgres        │   │  + embed  │  │
              │  ├─ tables       │   └───────────┘  │
              │  └─ pgvector ◀───┼──── embeddings   │
              │  Storage (files) │                  │
              └──────────────────┘                  │
                                                    │
   INDEXING (once per upload)                       │
   ─────────────────────────                        │
   upload ─▶ storage ─▶ extract text ─▶ chunk ─▶ embed ─▶ pgvector

   QUERY (per request)
   ────────────────────
   question ─▶ embed ─▶ vector search top-k ─▶ stuff chunks ─▶ Gemini ─▶ answer
```

**Key rule: the browser never talks to Gemini directly.** The API key lives only
in route handlers (`app/api/*`). Supabase keys in the browser are the anon key,
protected by Row Level Security (RLS). Streaming between route handlers and
React is handled by the Vercel AI SDK (`ai` + `@ai-sdk/google`).

---

## 3. Directory Ground Truth

This is the target shape of the repo. Existing directories are marked `[exists]`.

```
myapp/
├── app/
│   ├── study/                      [exists] feature hub page
│   │   ├── page.tsx                [exists] becomes the feature dashboard
│   │   ├── STUDY.MD                [exists] this file
│   │   ├── materials/
│   │   │   ├── page.tsx            material library (list, upload)
│   │   │   └── [id]/page.tsx       material detail: chat, summary, actions
│   │   ├── flashcards/
│   │   │   ├── page.tsx            deck list
│   │   │   └── [deckId]/page.tsx   review session (SM-2)
│   │   ├── quizzes/
│   │   │   ├── page.tsx            quiz list
│   │   │   └── [id]/page.tsx       take quiz / view graded results
│   │   ├── papers/page.tsx         past year paper repository
│   │   ├── predictor/page.tsx      exam question predictor
│   │   ├── path/page.tsx           personalized day-by-day study plan
│   │   └── planner/page.tsx        class/study schedule calendar
│   │
│   └── api/                        ALL server-side logic lives here
│       ├── materials/
│       │   ├── route.ts            POST upload → starts indexing pipeline
│       │   └── [id]/route.ts       GET/DELETE one material
│       ├── chat/route.ts           POST question + materialId → RAG answer
│       ├── summarize/route.ts      POST materialId + mode → summary
│       ├── flashcards/route.ts     POST materialId → generates deck
│       ├── quiz/route.ts           POST materialId → generates quiz
│       ├── quiz/[id]/grade/route.ts  POST essay answers → LLM grading
│       ├── translate/route.ts      POST materialId + targetLang
│       ├── predictor/route.ts      POST courseId → predicted questions
│       └── study-path/route.ts     POST goals/exam date → day-by-day plan
│
├── lib/
│   ├── types.ts                    [exists] extend with study types
│   ├── sample-data.ts              [exists] delete once DB is live
│   │
│   ├── supabase/
│   │   ├── client.ts               browser client (anon key)
│   │   ├── server.ts               server client (service role, API routes only)
│   │   └── middleware.ts           session refresh
│   │
│   ├── ai/                         THE AI PIPELINE — pure functions, no React
│   │   ├── gemini.ts               singleton Gemini client (reads env key)
│   │   ├── extract.ts              file buffer → plain text + page map
│   │   ├── chunk.ts                text → chunks with overlap + metadata
│   │   ├── embed.ts                text → 768-dim vector (Gemini embedding)
│   │   ├── retrieve.ts             question → top-k relevant chunks (pgvector)
│   │   ├── prompts.ts              every prompt template in one file
│   │   └── generate.ts             thin wrappers: summarize(), makeCards(),
│   │                               makeQuiz(), predict(), studyPath()
│   │
│   └── sm2.ts                      spaced repetition algorithm (~30 lines)
│
├── components/
│   ├── ui/                         [exists] Card, Badge, etc. — reuse these
│   ├── domain/                     [exists] TaskList, ResourceList — reuse
│   └── study/                      NEW: study-specific components
│       ├── FileUpload.tsx          drag/drop → POST /api/materials
│       ├── MaterialChat.tsx        chat thread UI
│       ├── FlashcardReview.tsx     flip card + Again/Good/Easy buttons
│       ├── QuizRunner.tsx          MCQ/TF/essay answer form
│       └── LanguageToggle.tsx      BM ↔ EN switch (context provider)
│
├── supabase/
│   ├── migrations/                 SQL migrations, applied in order
│   │   ├── 0001_init.sql           tables + pgvector extension
│   │   └── 0002_seed_papers.sql    curated past year papers
│   └── seed/                       actual PDF files of past papers
│
├── messages/                       i18n dictionaries
│   ├── en.json
│   └── ms.json                     Bahasa Melayu
│
└── .env.local                      GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
                                    SUPABASE_SERVICE_ROLE_KEY   ← never commit
```

### Design decisions behind this shape

1. **`lib/ai/` is pure TypeScript, no React, no Next imports.** You can run every
   function from a script or test without booting the framework. Route handlers
   are thin: parse request → call `lib/ai` → return JSON. This is the single
   most important boundary in the codebase.

2. **One file, one job in `lib/ai/`.** When retrieval returns garbage, you open
   `retrieve.ts`. When answers are bad, you open `prompts.ts`. Debugging a demo
   live on stage is only survivable if the suspicious code has an obvious home.

3. **All prompts in `prompts.ts`.** Prompt engineering is iterative. You will
   rewrite the quiz prompt ten times. If prompts were scattered across routes,
   you'd lose them.

4. **Migrations in SQL, not a GUI.** `supabase/migrations/*.sql` means the entire
   schema is reproducible from the repo. Judges and teammates can rebuild your
   database with one command.

---

## 4. The RAG Pipeline, Stage by Stage

This is the heart of the system. Each stage maps to one file in `lib/ai/`.

```
                         INDEXING PIPELINE (runs once per upload)
┌────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐
│ Upload │──▶│  Storage  │──▶│  Extract  │──▶│  Chunk   │──▶│  Embed   │──▶│  pgvector │
│  POST  │   │ raw file  │   │ text+pgs  │   │ ~600 tok │   │ 768-dim  │   │  chunks   │
└────────┘   └───────────┘   └───────────┘   └──────────┘   └──────────┘   └───────────┘
 extract.ts                   chunk.ts        embed.ts        retrieve.ts
 (writes back)

                          QUERY PIPELINE (runs per chat message)
┌───────────┐   ┌──────────┐   ┌─────────────────────┐   ┌──────────────┐   ┌────────┐
│ Question  │──▶│  Embed   │──▶│ Vector search top-k │──▶│ Prompt:      │──▶│ Gemini │──▶ answer
│  "what is │   │ question │   │ WHERE material_id=? │   │ chunks + Q   │   │ Flash  │    + page
│   X?"     │   │          │   │ ORDER BY embedding  │   │ "cite pages" │   │        │    citations
└───────────┘   └──────────┘   └─────────────────────┘   └──────────────┘   └────────┘
```

### Stage 1 — Extract (`extract.ts`)

Turn a file into plain text **while remembering which page/slide each piece came
from**. The page map is what powers citations later.

| File type | Tool | Note |
|---|---|---|
| PDF | `pdf-parse` | Returns text per page — keep that structure |
| DOCX | `mammoth` | Word files are zipped XML; mammoth unwraps them |
| PPTX | `officeparser` | Same trick for slides; slide number = "page" |
| Images | Gemini vision | Send the image to Gemini: "transcribe and describe this" |

Output shape: `{ pages: [{ page: 1, text: "..." }, ...] }`

### Stage 2 — Chunk (`chunk.ts`)

Split the text into pieces of roughly **500–800 tokens with ~10% overlap**.

- **Why chunk at all?** Retrieval quality. If you embed a whole 40-page chapter
  as one vector, the meaning averages out into mush. Small pieces have sharp,
  findable meaning.
- **Why overlap?** A sentence split across two chunks loses meaning in both.
  Overlap guarantees every idea appears whole in at least one chunk.
- **Why not one-chunk-per-page?** Pages vary wildly in density. Fixed token size
  with page metadata gives you both consistency *and* citations.

Each chunk records: `{ material_id, course_id, page, chunk_index, text }`.

### Stage 3 — Embed (`embed.ts`)

Send each chunk to Gemini's `text-embedding-004`; receive a 768-dimensional
vector — a list of 768 numbers that encodes the chunk's *meaning*. Texts with
similar meaning produce vectors that point in similar directions.

- This is why "photosynthesis" retrieves "how plants convert sunlight" even
  though they share no keywords. Keyword search cannot do this.
- Embeddings are computed **once at upload time** and stored. You never re-embed
  documents, only new questions.
- **Batch the embedding calls.** All chunks go into one `batchEmbedContents`
  call instead of one request per chunk. This collapses the slowest loop of
  indexing into a single API round trip — keeping the upload route well inside
  Vercel's function duration limit — and cuts your daily request count against
  the free tier by an order of magnitude.

### Stage 4 — Store (pgvector)

`pgvector` is a Postgres extension adding a `vector` column type and distance
operators. Chunks live in an ordinary table:

```sql
create extension if not exists vector;

create table chunks (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete cascade,
  course_id   uuid references courses(id),
  page        int,
  chunk_index int,
  text        text,
  embedding   vector(768)
);

-- the index that makes similarity search fast:
create index on chunks using hnsw (embedding vector_cosine_ops);
```

### Stage 5 — Retrieve (`retrieve.ts`)

When a question arrives:

1. Embed the **question** with the same model (must match — different models
   produce incompatible vector spaces).
2. Run one SQL query:

```sql
select text, page
from chunks
where material_id = $1            -- metadata filter: only THIS material
order by embedding <=> $2         -- <=> is cosine distance
limit 8;                          -- top-k
```

3. The metadata filter is as important as the vector search. "Quiz me on FIN345"
   must never retrieve radiotherapy chunks, no matter how similar they are.

### Stage 6 — Generate (`generate.ts` + `prompts.ts`)

Stuff the retrieved chunks into a prompt:

```
You are a study assistant. Answer ONLY from the context below.
Cite page numbers like [p.3]. If the answer isn't in the context, say so.

CONTEXT:
[p.3] ...chunk text...
[p.4] ...chunk text...

QUESTION: what is X?
```

The "answer only from context" instruction is what makes this *grounded*
(hallucination-resistant) instead of the model freelancing from training data.

### When RAG is NOT used

Honest architecture: RAG answers *questions*. For **whole-document** features
(summarize everything, flashcards from everything, quiz from everything),
retrieving "the most relevant chunks" is self-defeating — you want all of it.
With a 1M-token context window you can stuff the entire document directly.
So:

- **Chat** → RAG (retrieval)
- **Summaries, flashcards, quizzes, translation** → whole-document stuffing
- **Exam predictor** → hybrid: frequency analysis over past papers (SQL) +
  stuffing of relevant material chunks

This is what real products do. RAG is a tool, not a religion.

---

## 5. Data Model (Postgres)

```
courses ─────────┐
  id, code (FIN345), name, semester
                 │
materials ───────┤  uploaded study files
  id, course_id, user_id, title, file_url, file_type,
  language, status (indexing|ready|failed), created_at
                 │
chunks ──────────┤  RAG index (see section 4)
  id, material_id, course_id, page, chunk_index, text, embedding

papers ──────────┐  past year papers (seeded by admin)
  id, course_id, year, semester, file_url, extracted_text

summaries ───────┐  generated artifacts — one table per artifact type
  id, material_id, mode (short|detailed|study_guide), language, content

decks / cards ───┐  flashcards
  decks: id, material_id, title
  cards: id, deck_id, front, back,
         easiness, interval, repetitions, due_date   ← SM-2 state

quizzes / questions / attempts
  quizzes:   id, material_id, title
  questions: id, quiz_id, kind (mcq|tf|essay), prompt, options, answer, rubric
  attempts:  id, quiz_id, user_id, score, answers (jsonb), graded_at

study_plans / plan_days ─┐  day-by-day personalized path
  study_plans: id, user_id, course_id, exam_date, goals
  plan_days:   id, plan_id, day_number, date, topic, tasks (jsonb), done

schedule_blocks ─┐  planner
  id, user_id, title, kind (class|study|exam), starts_at, ends_at, recurrence
```

**Design decision: generated artifacts are persisted, not regenerated.** A
summary is generated once, stored, and rendered forever after. Never pay for
the same LLM call twice. This is both the cheap choice and the fast choice —
the summary page loads from Postgres, not from Gemini.

**RLS (Row Level Security):** every table with `user_id` gets a policy
`auth.uid() = user_id`. `papers` and `courses` are read-only for everyone.
This is how the anon key stays safe in the browser.

---

## 6. Feature → Machinery Map

| # | Feature | Pipeline | Endpoint | Tables |
|---|---|---|---|---|
| 1 | Chat with materials | **RAG** | `POST /api/chat` | chunks, materials |
| 2 | Auto summaries (3 modes) | Whole-doc stuffing | `POST /api/summarize` | summaries |
| 3 | Flashcards + SM-2 | Whole-doc stuffing + SM-2 | `POST /api/flashcards` | decks, cards |
| 4 | Quizzes (MCQ/TF/essay) | Whole-doc + LLM grading | `POST /api/quiz`, `/grade` | quizzes, questions, attempts |
| 5 | BM ↔ EN | Prompt param + translation | `POST /api/translate` | materials, all artifacts |
| 6 | Past paper repo | Pure CRUD | none (direct Supabase) | papers |
| 7 | Study path | LLM → stored plan | `POST /api/study-path` | study_plans, plan_days |
| 8 | Planner | Pure CRUD | none (direct Supabase) | schedule_blocks |
| 9 | Exam predictor | SQL frequency + stuffing | `POST /api/predictor` | papers, chunks |

### Per-feature notes

**1. Chat.** Retrieval as in §4. Responses are **streamed** to the browser
using the Vercel AI SDK (`ai` + `@ai-sdk/google`): the route handler returns a
stream instead of a JSON body, so tokens render as they generate. RAG +
generation takes 3–8 seconds; without streaming the UI feels frozen. Chat
history is passed as plain text in the prompt (last N turns). No fancy memory
needed at demo scale. Verify SDK compatibility with Next.js 16 against
`node_modules/next/dist/docs/` before writing the handler.

**2. Summaries.** Three modes = three prompt templates in `prompts.ts`
(`short`, `detailed`, `study_guide`), same endpoint, `mode` parameter.
Study guide mode adds structure instructions: headings, key terms, exam tips.

**3. Flashcards.** Gemini returns JSON: `[{front, back}, ...]`. Structured
output is enforced by setting `response_mime_type: "application/json"` plus a
schema — never parse free text. SM-2 lives in `lib/sm2.ts`:

```
SM-2 in one paragraph: each card has an easiness factor (starts 2.5),
an interval in days (starts 1), and a repetition count. When you rate a card:
  Again → interval resets to 1, easiness drops
  Good  → interval = interval × easiness
  Easy  → interval grows faster, easiness rises
Cards surface when due_date <= now(). That's the whole algorithm.

Timezone rule: due_date is stored as a UTC timestamp and "due" means
due_date <= now(). Comparing instants — never local calendar days — makes
surfacing correct in any timezone with zero offset plumbing.
```

**4. Quizzes.** MCQ and true/false are graded deterministically in code
(string comparison — never ask an LLM to grade what an `===` can grade).
Only essay answers go to the LLM, with a rubric generated alongside the
question. Grading is a second, separate endpoint call.

**5. Language.** Three layers:
- *Output toggle*: every prompt template accepts `language: "ms" | "en"`.
  One line in the prompt: "Respond in Bahasa Melayu."
- *Material translation*: extract → "translate this to X" → store as a new
  material row linked to the original.
- *UI i18n*: `messages/en.json` + `messages/ms.json` dictionaries, a
  `LanguageToggle` context provider, and `useTranslations()` in components.
  Translate core chrome (nav, buttons, study pages) first.

**6. Papers.** Admin seeds rows + files via `supabase/migrations/0002` and the
`seed/` folder. Users only read. Extract each paper's text at seed time so the
predictor can use it.

**7. Study path.** Inputs: course, exam date, goals. Gemini returns a JSON
array of days; each becomes a `plan_days` row. The UI is a checklist — marking
a day done is a plain `update`.

**8. Planner.** The simplest feature. `schedule_blocks` + a week-view grid.
No AI involved. The existing `TaskList` component pattern already fits.

**9. Exam predictor.** Two-step: (a) SQL/code — pull all past papers for a
course, have Gemini extract `{topic, question}` pairs per paper, count topic
frequency across years; (b) prompt — "Topics by frequency: ... Generate the 10
most likely exam questions with model answers." The frequency table makes this
feel analytical instead of magical — show it in the UI.

---

## 7. Sequence Diagrams

### Upload & indexing

```
Browser        /api/materials        Storage        extract/chunk/embed        pgvector
  │ upload file     │                  │                  │                       │
  │────────────────▶│ store raw        │                  │                       │
  │                 │─────────────────▶│                  │                       │
  │                 │ read back        │                  │                       │
  │                 │─────────────────▶│ pages {page,text}│                       │
  │                 │────────────────────────────────────▶│                       │
  │                 │                  │   chunks w/ vecs │                       │
  │                 │◀────────────────────────────────────│                       │
  │                 │ insert rows      │                  │                       │
  │                 │─────────────────────────────────────────────────────────────▶│
  │ 202 {id}        │                  │                  │                       │
  │◀────────────────│                  │                  │                       │
```

ponytail note: indexing runs synchronously in the request for v1, with
embeddings batched (one API call, see §4 Stage 3). Vercel Hobby allows
`maxDuration` up to 60s — set it on `/api/materials`. If a large PDF still
exceeds the limit, the upgrade path is client-driven incremental indexing: the
client chunks the file (5 pages at a time) and calls `/api/index-chunk` per
batch, which doubles as a real-time progress bar in the UI. The
`materials.status` column (`indexing|ready|failed`) already models this state
machine.

### Chat (RAG query)

```
Browser          /api/chat           embed.ts         pgvector          generate.ts
  │ "what is X?"    │                  │                │                  │
  │────────────────▶│ embed question   │                │                  │
  │                 │─────────────────▶│ vector         │                  │
  │                 │◀─────────────────│                │                  │
  │                 │ top-k filtered   │                │                  │
  │                 │─────────────────────────────────▶│ chunks            │
  │                 │◀─────────────────────────────────│                  │
  │                 │ chunks + question + history                         │
  │                 │─────────────────────────────────────────────────────▶│
  │ answer + pages  │                                                     │
  │◀────────────────│◀────────────────────────────────────────────────────│
```

---

## 8. Cost Model

| Service | Free tier | Will a demo exceed it? |
|---|---|---|
| Gemini 2.5 Flash | ~1,500 requests/day | No |
| Gemini embeddings | ~1,500 requests/day | No (embed once per chunk at upload) |
| Supabase | 500 MB DB, 1 GB storage | No (papers are a few MB) |
| Vercel | Hobby tier | No |

**Monthly cost at demo scale: RM0.** The two rules that keep it that way:

1. **Persist every generated artifact** (§5). One generation, infinite reads.
2. **Gemini key is server-side only** (§2), so nobody can scrape it from the
   browser and run up your bill. Rate-limit per user later if needed.

---

## 9. Security & Boundaries Checklist

- [ ] `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only in `.env.local`,
      only read inside `app/api/*` and `lib/ai/*`
- [ ] RLS enabled on every user-owned table; policies tested, not assumed
- [ ] File upload validation: type allowlist (pdf/docx/pptx/png/jpg) and size
      cap (~20 MB) enforced in `/api/materials` before touching storage
- [ ] LLM output for cards/quizzes/plans requested as JSON schema, parsed with
      a validator, and the request retried once on parse failure
- [ ] All LLM JSON responses go through one parser in `lib/ai/generate.ts` that
      strips markdown fences before parsing — `response_mime_type:
      "application/json"` does not stop the model from wrapping output in
      ` ```json ` blocks:

      ```ts
      const cleanJsonString = (raw: string) =>
        raw.replace(/```json\n?|```/g, "").trim();
      ```

      Parse inside try/catch and retry the request once on failure.

---

## 10. Glossary (learn these terms)

- **Embedding** — a vector of numbers encoding a text's meaning; similar
  meanings → nearby vectors
- **Cosine distance (`<=>`)** — how "far apart" two vectors' directions are;
  smaller = more similar
- **Chunk** — a small slice of a document; the unit of retrieval
- **Top-k** — retrieve the k most similar chunks (k ≈ 6–10)
- **Grounding** — forcing the LLM to answer only from provided context
- **Structured output** — making the LLM reply in JSON matching a schema
- **RLS** — Postgres Row Level Security; the DB itself enforces "users only
  see their own rows"
- **SM-2** — the classic spaced-repetition scheduling algorithm (SuperMemo 2)
- **HNSW** — the index type making vector search fast (a graph of nearby
  vectors, instead of scanning every row)
- **Route handler** — a Next.js server endpoint (`app/api/**/route.ts`)
- **Service role key** — Supabase admin key that bypasses RLS; server-only
