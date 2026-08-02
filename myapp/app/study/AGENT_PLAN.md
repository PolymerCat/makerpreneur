# Agentic Study Tutor — Design + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the Study Hub chat into a tool-using agent with 10 capabilities, add LLM logging, and rewrite repo docs for recruiters.

**Architecture:** Hand-rolled Gemini function-calling loop (`app/study/_lib/ai/agent.ts`) + thin SSE route (`app/study/api/chat/route.ts`). Tools (`app/study/_lib/ai/tools.ts`) call the existing server actions directly (plain async functions server-side). Logging via `app/study/_lib/ai/logger.ts` → `logs/llm.jsonl` (dev) + Supabase `llm_logs` (prod).

**Tech Stack:** Next.js 16 App Router, `@google/genai`, Supabase (pgvector, RLS), vitest.

---

## Design

### Agent capabilities (10 tools)

| Tool | Inputs | Output (string fed back to model) | Backed by |
|---|---|---|---|
| `search_material` | question, topK? | `[i] chunk text…` (RRF-fused) | retrieval moved out of chat route; respects `materialIds` in `ToolCtx` with fallback to `subjectId` |
| `search_memory` | query | matching memory entries (type, importance) | `sdb.memorySearch` |
| `save_memory` | content, type, tags? | saved id | `aiSaveMemory` flow |
| `generate_flashcards` | topic, cardCount? | deck id + link + preview | `aiMakeFlashcards` |
| `generate_quiz` | topic, questionCount? | quiz id + link + preview | `aiMakeQuiz` |
| `get_exam_readiness` | — | formatted raw stats (attempts avg, papers results, plan progress) | attempts + papers + plan progress; outer LLM synthesizes assessment |
| `get_study_plan` | dayNumber? | days, done flags, exam date, goals | `study_plans` + `plan_days` |
| `search_past_papers` | query | paper names, years, URLs | `papers` + `paperText` |
| `translate_text` | text, targetLanguage | translation | `aiTranslate` |
| `generate_exam_paper` | paperIds | PDF URL | `aiGeneratePdfExam` pipeline |

Tool rules: every tool returns a **string**; errors return `{ ok: false, error }` fed back to the model; `generate_exam_paper` returns a URL, never bytes.

### Context awareness

At request start, one cheap DB read injects into the system prompt (on top of the existing Study Buddy persona + language instruction): active subject name (`subjects`), exam date + goals (`study_plans`), today's `plan_days` topic/tasks, top-3 weakness memories. All reads via `sdb` (anon key + session cookies) so RLS from `0009_subjects_ownership.sql` scopes everything to the owner.

### Loop + SSE

1. `llm.generateContent(messages, tools)` — non-streaming probe.
2. `functionCalls` → emit `tool_start`, execute, append result, emit `tool_end`; repeat, **max 4 iterations**. If the model emits multiple parallel function calls in a single turn, execute **all** calls and send all responses in one message.
3. Plain text → stream final answer via `generateContentStream`, then `done`.
4. Hard failure → legacy RAG fallback (existing route code kept). Chat never breaks. All `/api/chat` responses (agent turns, semantic cache hits, and legacy RAG fallbacks) are standardized to stream as SSE (`text/event-stream`) so the client only needs a single unified SSE line parser.

```
data: {"type":"tool_start","tool":"search_material"}
data: {"type":"tool_end","tool":"search_material","durationMs":412}
data: {"type":"text","content":"The answer is…"}
data: {"type":"done","conversationId":"…","messageId":"…"}
```

Semantic cache (question→answer) hits when the answer used **zero tools** OR when the only tools called were stateless retrieval tools (`search_material`, `search_past_papers`, `translate_text`). Chat page keeps conversation persistence, memory extraction, language toggle, course bar; adds a tool activity strip that clears when text starts.

### In-Chat Interactive UI Components & Activity Strip

To make agent actions visual and interactive directly within the chat stream, `chat/page.tsx` renders custom interactive JSX widgets inside the assistant message bubble for tool outputs:

1. **`<ToolActivityStrip />` (Live Agent Action Tracker)**
   - Renders live animated chips above the assistant bubble during execution: `[🔍 search_material] Searching course materials…`, `[🗂️ generate_flashcards] Crafting flashcards…`, `[📄 generate_exam_paper] Generating PDF exam…`.
   - Displays execution time (ms) and success checkmark upon completion before clearing when text streams.

2. **`<FlashcardCard />` (Interactive In-Chat Flashcard Widget)**
   - Automatically detected from flashcard deck output markdown links (`/study/flashcards/{deckId}`).
   - Displays a sleek dark glassmorphic card with deck title, total card count, an interactive 3D flip card preview (front/back flip animation inside chat), and a primary action button (`Practice Deck →`).

3. **`<QuizCard />` (Interactive In-Chat Quiz Widget)**
   - Automatically detected from quiz output markdown links (`/study/quizzes/{quizId}`).
   - Renders a styled quiz card with topic badge, question count, interactive option pills preview for Question 1, and a primary CTA button (`Start Quiz Now →`).

4. **`<ExamPaperCard />` (PDF Exam Document Widget)**
   - Automatically detected from PDF URLs generated by `generate_exam_paper`.
   - Displays a PDF document preview card with course code badge, document icon, filename, and direct `Download PDF` + `View PDF` buttons.

5. **`<ReadinessGaugeCard />` (Visual Exam Readiness Dashboard)**
   - Renders a visual readiness card when `get_exam_readiness` runs, featuring progress bars for Quiz Averages, Past Paper Scores, and Study Plan progress alongside the AI assessment.

### Logging

`logger.ts`: `logLlmCall` / `logToolCall`, fire-and-forget, never throws. Uses Next.js 16's `after()` from `"next/server"` to execute Supabase logging reliably after the HTTP response stream completes. `gemini.ts` must return `usageMetadata` (currently discarded) + per-model cost table. Fields: requestId, task, model, promptVersion, latencyMs, tokens, costUs, tool calls, retrieved chunk ids. Migration `0010_llm_logs.sql` (0009 taken) + RLS insert/select own rows. `scripts/analyze-logs.ts`: cost by task, p50/p95 latency, tokens, tool-call counts.

### Docs

Main recruiter-facing `README.md` and `AGENTS.md` placed in the git repository root (`makerpreneur/`) for immediate GitHub landing page visibility; `docs/ARCHITECTURE.md` (RAG flow, agent loop, logging, schema, RLS story), `.env.example`, and package.json name → `makerpreneur-study-hub` in `myapp/`.

### Deliberately out of scope

No eval harness (next differentiator — separate spec), no LangGraph, no streaming tool outputs, no Docker.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `app/study/_lib/ai/gemini.ts` | modify | return `usageMetadata`; expose per-call usage |
| `app/study/_lib/ai/logger.ts` | create | `logLlmCall` / `logToolCall` (JSONL + Supabase, fire-and-forget) |
| `app/study/_lib/ai/tools.ts` | create | 10 tool definitions |
| `app/study/_lib/ai/agent.ts` | create | function-calling loop + SSE event generator |
| `app/study/api/chat/route.ts` | refactor | context injection → agent (fallback: legacy RAG) → SSE |
| `app/study/chat/page.tsx` | modify | SSE parsing + tool activity strip |
| `app/study/_sql/0010_llm_logs.sql` | create | llm_logs table + RLS |
| `app/study/_lib/supabase-db.ts` | modify | `llmLogs` field mapper |
| `app/study/_lib/ai/retrieve.ts` | modify | fix `rrfFuse` keying bug |
| `app/study/_lib/ai/agent.test.ts`, `tools.test.ts` | create | vitest unit tests (mocked `llm`) |
| `scripts/analyze-logs.ts` | create | cost/latency/token summary |
| `README.md`, `docs/ARCHITECTURE.md`, `.env.example`, `package.json` | rewrite | Phase 1 docs |
| `AGENTS.md` (repo root) | create | Next.js-version warning |

---

### Task 1: Surface usageMetadata + add function-calling & streaming APIs to gemini.ts

**Files:** Modify `app/study/_lib/ai/gemini.ts`

> **Grill amendment (2026-08-02):** The agent loop (Task 6) needs two APIs that do NOT exist yet — a function-calling probe and a stream. This task now adds them; the loop code otherwise cannot compile.

- [x] **Step 1: Read `app/study/_lib/ai/gemini.ts` fully; find every call site that discards `response.usageMetadata`.**
- [x] **Step 2: Make `generate` / `generateJson` return usage.** Change the return shape so each LLM call reports tokens and model:

```ts
export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};
export type LlmResult<T> = { value: T; usage: LlmUsage };
```

`generate`/`generateJson` return `LlmResult<…>` (value + usage). Update **all** consumers to `.value` — `actions.ts`, `retrieve.ts` (`expandQueries`), `detect.ts` (`detectMetadata`), `memory.ts` (`extractMemory`). Do NOT change the model fallback chain or `MIN_GAP` logic.

- [x] **Step 3: Add `generateContent(messages, opts)` to `llm`** — non-streaming probe for the agent loop:
  - Signature: `(messages: any[], opts: { tools?: any; temperature?: number; task?: string }) => Promise<{ text: string; functionCalls: any[]; usage: LlmUsage }>`.
  - Same fallback chain + `MIN_GAP` + `trackCall` as `generate`; passes `opts.tools` through to `client.models.generateContent({ contents: messages, config: { temperature, tools } })`.
  - `functionCalls` = `response.functionCalls ?? []`; `usage` from `response.usageMetadata` (fallback zeros when absent).
- [x] **Step 4: Add `generateContentStream(messages, opts)` to `llm`** — streams final text:
  - Returns `AsyncIterable<string>` of text chunks (from `client.models.generateContentStream`), with the same fallback chain.
  - Exposes usage via `opts.onUsage?: (usage: LlmUsage) => void` callback (called on the first non-error response).
- [x] **Step 5: Verify.** `npm run build` passes; `npm run lint` clean.

- [x] **Step 6: Commit.** `git add app/study/_lib/ai/gemini.ts app/study/actions.ts app/study/_lib/ai/retrieve.ts app/study/_lib/ai/detect.ts app/study/_lib/ai/memory.ts; git commit -m "feat: LLM usage metadata, function-calling probe, streaming"`

### Task 2: logger.ts

**Files:** Create `app/study/_lib/ai/logger.ts`

- [x] **Step 1: Write the logger.** One module, two functions, fire-and-forget writes that never throw:

```ts
import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as fs from "node:fs";
import * as path from "node:path";

export type LlmLogEntry = {
  requestId: string;
  task: string;
  model: string;
  promptVersion?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costUs?: number;
  toolCalls?: { tool: string; ok: boolean; durationMs: number }[];
  retrievedChunkIds?: string[];
  createdAt: string;
};

const MODEL_RATES: Record<string, { in: number; out: number }> = {
  "gemini-3.6-flash": { in: 0.15, out: 0.6 },   // $ per 1M tokens
  "gemini-3.5-flash": { in: 0.3, out: 1.2 },
  "gemini-2.5-pro":   { in: 1.25, out: 10 },
  default:            { in: 0.3, out: 1.2 },
};

export function estimateCostUs(model: string, inTok: number, outTok: number): number {
  const r = MODEL_RATES[model] ?? MODEL_RATES.default;
  return (inTok / 1e6) * r.in + (outTok / 1e6) * r.out;
}

const LOG_PATH = path.join(process.cwd(), "logs", "llm.jsonl");

export function logLlmCall(entry: LlmLogEntry, userId?: string): void {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
    if (userId) {
      after(async () => {
        await supabaseLog(userId, entry);
      }); // Next.js 16 after() ensures completion post-stream
    }
  } catch { /* logging must never break chat */ }
}

export function logToolCall(requestId: string, tool: string, ok: boolean, durationMs: number): void {
  try {
    fs.appendFileSync(LOG_PATH, JSON.stringify({ requestId, type: "tool", tool, ok, durationMs, createdAt: new Date().toISOString() }) + "\n");
  } catch { /* no-op */ }
}

async function supabaseLog(userId: string, entry: LlmLogEntry): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from("llm_logs").insert({
      user_id: userId,
      request_id: entry.requestId,
      task: entry.task,
      model: entry.model,
      prompt_version: entry.promptVersion,
      latency_ms: entry.latencyMs,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_us: entry.costUs,
      tool_calls: entry.toolCalls,
      retrieved_chunk_ids: entry.retrievedChunkIds,
    });
  } catch { /* no-op */ }
}
```

- [x] **Step 2: Add `logs/` to `.gitignore`.**
- [x] **Step 3: Commit.** `git add app/study/_lib/ai/logger.ts .gitignore; git commit -m "feat: structured LLM logger (JSONL + Supabase)"`

### Task 3: 0010_llm_logs.sql + db wiring

**Files:** Create `app/study/_sql/0010_llm_logs.sql`, modify `app/study/_lib/supabase-db.ts`

- [x] **Step 1: Write the migration.**

```sql
-- Migration: 0010_llm_logs.sql
create table if not exists public.llm_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  request_id text not null,
  task text not null,
  model text not null,
  prompt_version text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  cost_us numeric(12, 8),
  tool_calls jsonb,
  retrieved_chunk_ids text[],
  created_at timestamptz default now()
);

alter table public.llm_logs enable row level security;
drop policy if exists "Users can insert own llm_logs" on public.llm_logs;
drop policy if exists "Users can view own llm_logs" on public.llm_logs;

create policy "Users can insert own llm_logs"
  on public.llm_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can view own llm_logs"
  on public.llm_logs for select to authenticated
  using (user_id = auth.uid());

create index if not exists llm_logs_request_id_idx on public.llm_logs (request_id);
create index if not exists llm_logs_created_at_idx on public.llm_logs (created_at desc);
```

- [x] **Step 2: Add `llmLogs` to the field mapper in `supabase-db.ts`** (follow the existing `subjects` entry pattern: `{ requestId: "request_id", promptVersion: "prompt_version", latencyMs: "latency_ms", inputTokens: "input_tokens", outputTokens: "output_tokens", costUs: "cost_us", toolCalls: "tool_calls", retrievedChunkIds: "retrieved_chunk_ids", createdAt: "created_at" }`).
- [x] **Step 3: Commit.** `git add app/study/_sql/0010_llm_logs.sql app/study/_lib/supabase-db.ts; git commit -m "feat: llm_logs migration and field mapping"`

### Task 4: Fix rrfFuse keying bug

**Files:** Modify `app/study/_lib/ai/retrieve.ts`

- [x] **Step 1: Read `retrieve.ts`; the bug is in `rrfFuse`** — it keys the score map by `item.text`, so duplicate chunk texts silently merge. Key by `item.materialId + ":" + itemIndex` (or any unique id present on items) instead.
- [x] **Step 2: Commit.** `git add app/study/_lib/ai/retrieve.ts; git commit -m "fix: rrfFuse merges duplicate chunk texts"`

### Task 5: tools.ts — the 10 tool definitions

**Files:** Create `app/study/_lib/ai/tools.ts`

- [x] **Step 1: Define the ToolDef shape and ToolCtx.**

```ts
export type ToolResult = { ok: true; result: string } | { ok: false; error: string };
export type ToolCtx = { userId: string; subjectId: string; language: string; materialIds: string[] };
export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<ToolResult>;
};
```

> **Grill amendment (2026-08-02):** `search_material` additionally surfaces chunk ids for logging. `run` for that tool returns `{ ok: true; result: string; chunkIds: string[] }` (widening ToolResult is fine — the agent strips `chunkIds` before feeding the model). The route logs `chunkIds` as `retrievedChunkIds`.

- [x] **Step 2: Implement the 10 tools**, wiring to existing code:
  - `search_material`: move the retrieval pipeline out of `app/study/api/chat/route.ts` (embed → expandQueries → vectorSearch per material → rrfFuse → top `2*TOP_K` chunks) into a function in `tools.ts` (or `_lib/ai/retrieve.ts`); uses `ctx.materialIds` to respect UI checkboxes, automatically falling back to all ready materials for `ctx.subjectId` when `ctx.materialIds` is empty; returns numbered chunk texts **plus the material/chunk ids of the winning chunks**.
  - `search_memory`: `sdb.memorySearch(userId, subjectId?, embedding)` → formatted entries.
  - `save_memory`: `aiEmbedTexts(content)` then insert into `memories` (reuse `aiSaveMemory` logic).
  - `generate_flashcards`: call `aiMakeFlashcards(text, language, cardCount, memoryText)`; **persist server-side** — replicate the insert logic from `app/study/flashcards/page.tsx:64` (`db.insert("decks", …)` + cards with sm2 defaults) using `sdb`; returns deck link `/study/flashcards/{deckId}` + preview of first 3 cards. (If only a topic is given, first `search_material` the topic.)
  - `generate_quiz`: same pattern via `aiMakeQuiz` → **persist** (mirror `app/study/quizzes/page.tsx:63` insert of quiz + questions) → `/study/quizzes/{quizId}`.
  - `get_exam_readiness`: aggregate `attempts` (avg score per quiz) + `papers` results + `plan_days.done` progress for the subject; return formatted raw stats directly as text, letting the outer agent LLM synthesize the readiness assessment (no internal `llm.generateJson` call).
  - `get_study_plan`: `sdb` reads of `study_plans` + `plan_days`; format "Day N (date): topic — tasks (done/pending)".
  - `search_past_papers`: papers list filtered by subject, keyword-matched on name; return names + years + storage URLs.
  - `translate_text`: `aiTranslate(text, targetLanguage)`.
  - `generate_exam_paper`: reuse `aiGeneratePdfExam` internals (syllabusText + pastPapersText → `generateExamPaperJsonPrompt` → `llm.generate` → `generatePdfFromExamJson` → storage upload → `generated_exams` insert); return the PDF URL.
- [x] **Step 3: Every tool wraps its body in try/catch returning `{ ok: false, error }`.** Never throw.

- [x] **Step 4: Commit.** `git add app/study/_lib/ai/tools.ts app/study/api/chat/route.ts; git commit -m "feat: agent tool router (10 tools)"`

### Task 6: agent.ts — the loop

**Files:** Create `app/study/_lib/ai/agent.ts`

> **Grill amendment (2026-08-02):** Handle ALL function calls returned in one probe — echo every `functionCall` back into the model message and execute each in sequence (the SDK errors if a returned call is not echoed). `calls[0]`-only handling is removed.

- [x] **Step 1: Write the loop.** Non-streaming probe with tools; on `functionCalls` run tools and feed results back; max 4 probe iterations; final text streamed; emits SSE event objects:

```ts
export type AgentEvent =
  | { type: "tool_start"; tool: string }
  | { type: "tool_end"; tool: string; durationMs: number }
  | { type: "text"; content: string }
  | { type: "done"; toolCount: number };

export async function runAgent(params: {
  userId: string;
  question: string;
  subjectId: string;
  language: string;
  injectedContext: string;
  chatHistory: string;
  memories: string;
}): Promise<AsyncGenerator<AgentEvent>> {
  const { userId, question, language, injectedContext, chatHistory, subjectId } = params;
  const tools = buildGeminiTools();               // 10 functionDeclarations from tools.ts
  const systemPrompt = buildAgentSystemPrompt({ injectedContext, language, chatHistory });
  const messages = [{ role: "user", parts: [{ text: question }] }];
  let toolCount = 0;

  for (let i = 0; i < 4; i++) {
    const res = await llm.generateContent([...messages], { tools, temperature: 0.3, task: "agent" });
    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      // final answer: stream it
      const stream = llm.generateContentStream([...messages, { role: "model", parts: [{ text: res.text }] }], { task: "agent_final" });
      for await (const chunk of stream) yield { type: "text", content: chunk };
      yield { type: "done", toolCount };
      return;
    }
    messages.push({ role: "model", parts: calls.map((c) => ({ functionCall: c })) });  // echo ALL calls
    for (const call of calls) {                                                         // execute each
      const started = Date.now();
      yield { type: "tool_start", tool: call.name };
      const out = await executeTool(call, { userId, subjectId, language });
      yield { type: "tool_end", tool: call.name, durationMs: Date.now() - started };
      toolCount++;
      messages.push({ role: "user", parts: [{ functionResponse: { name: call.name, response: out } }] });
    }
  }
  yield { type: "text", content: "I've used up my search budget — let me give you what I have so far." };
  yield { type: "done", toolCount };
}
```

- [x] **Step 2: `buildAgentSystemPrompt`** = existing Study Buddy persona + injected context block + language instruction + tool-usage rules ("call tools only when needed; answer in the user's language; cite [i] when using search_material results").
- [x] **Step 3: `executeTool`** looks up the def in the registry, validates args minimally, calls `run`, returns the `ToolResult`; unknown tool → `{ ok: false, error: "unknown tool" }`.

- [x] **Step 4: Commit.** `git add app/study/_lib/ai/agent.ts; git commit -m "feat: agentic tool-call loop"`

### Task 7: Unit tests (mocked llm)

**Files:** Create `app/study/_lib/ai/agent.test.ts`, `app/study/_lib/ai/tools.test.ts`; add vitest devDependency + `"test": "vitest run"` script in `package.json`

- [x] **Step 1: Add vitest.** `npm i -D vitest` and add the `test` script.
- [x] **Step 2: Mock `llm`** (vi.mock `./gemini`): a fake that returns function calls for N turns then text.
- [x] **Step 3: Test tool router:** `executeTool` with bad args returns `{ ok: false, error }`; unknown tool returns error; `search_material` returns numbered chunks.
- [x] **Step 4: Test iteration cap:** fake llm returns function calls every time → generator ends after 4 iterations with the budget message.
- [x] **Step 5: Test SSE serialization:** collect events from `runAgent` with a 1-tool fake → exact sequence `tool_start → tool_end → text → done`.
- [x] **Step 6: Run:** `npm test` → all pass.
- [x] **Step 7: Commit.** `git add package.json app/study/_lib/ai/*.test.ts; git commit -m "test: agent loop, tool router, SSE sequence"`

### Task 8: Route refactor — context injection + SSE

**Files:** Modify `app/study/api/chat/route.ts`

- [x] **Step 1: Read the full route (318 lines) first.** Keep the existing legacy RAG path intact as the fallback. Standardize all `/api/chat` responses (agent path, semantic cache hit, and legacy RAG fallback) to emit SSE events (`text/event-stream`), so the client UI only needs a single unified SSE line parser.
- [x] **Step 2: Session + subject resolution** (already exists) → build `injectedContext` in one DB read: subject name, `study_plans` (examDate, goals), today's `plan_days` (topic, tasks, done), top-3 weakness memories.
- [x] **Step 3: Try agent path first:** `runAgent(...)` passing `materialIds` in `ToolCtx`; wrap the generator in an SSE `ReadableStream` (`data: ` + JSON + `\n\n`); set `Content-Type: text/event-stream`. Any agent exception → log + fall through to legacy path.
- [x] **Step 4: Semantic cache for stateless answers** (cache when `toolCount === 0` OR when only stateless retrieval tools `search_material`, `search_past_papers`, `translate_text` were used).
- [x] **Step 5: Log** every LLM call via `logLlmCall` with `requestId`, task (`agent`, `search`, …), usage from Task 1, `retrievedChunkIds` from `search_material`, cost from `estimateCostUs`.
- [x] **Step 6: Commit.** `git add app/study/api/chat/route.ts; git commit -m "feat: SSE agent endpoint with legacy fallback"`

### Task 9: Chat page — SSE parsing, live tool strip & rich in-chat artifact UI

**Files:** Modify `app/study/chat/page.tsx`

- [x] **Step 1: Read `chat/page.tsx` around rendering (~line 270 user content, ~line 670 assistant bubble, ~line 450 fetch stream).**
- [x] **Step 2: Add SSE event parser.** Parse `data: ` JSON events (`tool_start`, `tool_end`, `text`, `done`). Update `toolActivity` state on `tool_start` / `tool_end` to display `<ToolActivityStrip />` with animated spinners and duration chips.
- [x] **Step 3: Implement In-Chat Interactive Artifact Components:**
  - Create `<FlashcardCard deckId={id} title={t} count={n} preview={cards} />` with interactive flip animation state.
  - Create `<QuizCard quizId={id} title={t} count={n} sample={q1} />` with option pill styling and start CTA.
  - Create `<ExamPaperCard pdfUrl={url} title={title} courseCode={code} />` with PDF icon, download button, and preview link.
  - Create `<ReadinessGaugeCard stats={stats} assessment={text} />` with visual progress bars.
- [x] **Step 4: Custom Markdown Renderer for Artifacts.** Update `renderMarkdown` (or post-process assistant message content) to parse output links (`/study/flashcards/…`, `/study/quizzes/…`, `.pdf` URLs) and replace raw links with the rich interactive UI cards directly inside the assistant message bubble.
- [x] **Step 5: Smoke test** creating flashcards, quizzes, PDF exams, and readiness checks in chat to verify live tool activity chips and interactive cards.
- [x] **Step 6: Commit.** `git add app/study/chat/page.tsx; git commit -m "feat: in-chat interactive flashcard, quiz, PDF, and readiness UI cards with live tool activity strip"`

### Task 10: analyze-logs.ts

**Files:** Create `scripts/analyze-logs.ts`; add `"analyze-logs"` script to package.json (run via `npx tsx`)

- [x] **Step 1: Read `logs/llm.jsonl`** (or Supabase via env) and print:
  - total cost USD (sum `costUs`) + cost by `task`;
  - p50/p95 `latencyMs` per task;
  - total input/output tokens;
  - tool-call counts by tool with failure rate.
- [x] **Step 2: Commit.** `git add scripts/analyze-logs.ts package.json; git commit -m "feat: log analyzer (cost/latency/tokens)"`

### Task 11: Phase 1 docs

**Files:** Rewrite recruiter `README.md` and create `AGENTS.md` in the git repository root (`makerpreneur/`); create `docs/ARCHITECTURE.md`, `.env.example`, and modify `package.json` (name → `makerpreneur-study-hub`) in `myapp/`

- [x] **Step 1: README (git root `makerpreneur/README.md`)** — problem, target user, feature list (agent + 10 tools), Mermaid architecture diagram, decisions table (chose X over Y, why), limitations, run commands, test command, sample transcript (capture from smoke test).
- [x] **Step 2: `docs/ARCHITECTURE.md` (in `myapp/docs/`)** — RAG flow, agent loop diagram, logging pipeline, DB schema summary, RLS ownership story.
- [x] **Step 3: `.env.example`** — key names only: `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] **Step 4: `AGENTS.md` (git root `makerpreneur/AGENTS.md`)** — "This is NOT the Next.js you know — read `node_modules/next/dist/docs` before writing code."
- [x] **Step 5: Commit.** `git add ../README.md ../AGENTS.md docs/ .env.example package.json; git commit -m "docs: portfolio-grade README and architecture"`

### Task 12: End-to-end verification

- [ ] **Step 1: `npm run dev`** and test:
  - "Make me flashcards on today's chapter" → chips appear, deck link returned;
  - "Am I ready for my exam?" → readiness assessment with stats;
  - "Translate X to Bahasa Melayu" → translation, no tools;
  - "What did I plan for today?" → plan-aware answer;
  - ask a nonsense question and confirm the fallback message still streams.
- [ ] **Step 2: `npm run build` and `npm run lint`** — clean.
- [ ] **Step 3: `npm test`** — all pass. `npm run analyze-logs` — sensible output.
