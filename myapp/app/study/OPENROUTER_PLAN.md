# OpenRouter Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every LLM call (text, JSON, tool calling, streaming, vision) through OpenRouter free models first, with the existing Gemini direct calls as the fallback chain, without changing any caller.

**Architecture:** Single-file rewrite of `app/study/_lib/ai/gemini.ts` internals into a dual-provider module. All consumers (`actions.ts`, `agent.ts`, `retrieve.ts`, `detect.ts`, `memory.ts`, `extract/route.ts`) keep importing the same `llm` object with the same signatures — zero caller changes. A translation layer converts the Gemini-native message/tool format the agent already produces into OpenAI-compatible format for OpenRouter's `https://openrouter.ai/api/v1/chat/completions` (called with plain `fetch` — no new SDK). Embeddings (`embedTexts`) stay on direct Gemini: OpenRouter has **zero** embedding models. Your Gemini key can be registered on OpenRouter as a BYOK key (Task 0) so the `google/gemini-*` OpenRouter slots route through your own key at ~0 cost.

**Tech Stack:** Next.js 16 App Router, `@google/genai` (retained for direct-Gemini fallback + embeddings), plain `fetch` (OpenAI-compatible REST), vitest. No new npm dependencies.

**Branch:** work on the current branch (`merge-study-planner-NEW-UI`). Commit after every task, style `feat:` / `test:` matching the repo.

---

## Design

### The model chain ("slots")

Each slot is `{ provider: "openrouter" | "gemini", model }`. The chain tries slots in order; on failure (especially 429 quota, which free endpoints hit often) it cooldowns that slot and falls to the next. Two chains: `TEXT_SLOTS` (text/JSON/tools/stream) and `VISION_SLOTS` (images).

| # | Slot | Provider | Tools | Vision | Why |
|---|---|---|---|---|---|
| 1 | `openrouter/free` | OpenRouter | ✅ | ✅ | Auto-routes to best live free endpoint |
| 2 | `google/gemma-4-31b-it:free` | OpenRouter | ✅ | ✅ | Strong free model, 262k ctx |
| 3 | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | OpenRouter | ✅ | ✅ | Reasoning + vision |
| 4 | `openai/gpt-oss-20b:free` | OpenRouter | ✅ | ❌ | OpenAI-format native |
| 5 | `google/gemini-3.5-flash` | OpenRouter (BYOK) | ✅ | ✅ | Your Gemini key via BYOK, ~0 cost |
| 6 | `google/gemini-3.6-flash` | OpenRouter (BYOK) | ✅ | ✅ | Same |
| 7 | `gemini-3.6-flash` | Gemini direct | ✅ | ✅ | Last-resort direct fallback |
| 8 | `gemini-3.5-flash` | Gemini direct | ✅ | ✅ | |
| 9 | `gemini-3.5-flash-lite` | Gemini direct | ✅ | ✅ | |

`VISION_SLOTS` = slots 1–7 restricted to vision-capable entries.

### Translation rules (Gemini format ↔ OpenAI format)

The agent (`agent.ts`) builds Gemini-native messages and `buildGeminiTools()` returns `[{ functionDeclarations }]`. `generateContent` / `generateContentStream` must translate before calling OpenRouter, and translate OpenRouter responses back into the exact shape the agent already consumes (`{ text, functionCalls: [{name, args}] }`).

| Gemini (what the code sends today) | OpenAI (what OpenRouter needs) |
|---|---|
| `{ role:"user", parts:[{text}] }` | `{ role:"user", content:"text" }` |
| `{ role:"user", parts:[{inlineData:{mimeType,data}}] }` | `{ role:"user", content:[{type:"image_url", image_url:{url:"data:{mime};base64,{data}"}}] }` |
| `{ role:"model", parts:[{functionCall:{name,args}}] }` | `{ role:"assistant", content:null, tool_calls:[{id:"call_N", type:"function", function:{name, arguments:JSON.stringify(args)}}] }` |
| `{ role:"user", parts:[{functionResponse:{name,response}}] }` | one `{ role:"tool", tool_call_id:"call_N", content:JSON.stringify(response) }` per part, ids matched in order |
| `tools: [{ functionDeclarations: [{name,description,parameters}] }]` | `tools: [{ type:"function", function:{name,description,parameters} }]` |
| response `functionCalls` | `choices[0].message.tool_calls[]` → `{ name, args }` (args JSON-parsed) |
| `usageMetadata.promptTokenCount/candidatesTokenCount` | `usage.prompt_tokens` / `usage.completion_tokens` |

`tool_call_id` matching: when translating an assistant message with `tool_calls`, push each generated id onto a queue; when translating the next user message's `functionResponse` parts, shift ids off the queue in order. The agent echoes calls and sends responses in the same order (its `Promise.all` preserves order), so queue order is correct even with duplicate tool names.

### Free-model constraints baked into the design

- **Rate limit:** OpenRouter free tier ≈ 20 RPM per model. Per-provider `MIN_GAP`: `{ gemini: 0.35, openrouter: 3 }` (3s ≈ 20 RPM).
- **Headers:** free models REQUIRE `HTTP-Referer` and `X-Title` headers — always send them.
- **JSON mode:** send `response_format: { type: "json_object" }`; some free models ignore it, so keep the existing codeblock-strip JSON repair (`parseJsonRepair`).
- **PDFs:** OpenRouter free models reject `application/pdf` data URLs (images only). `generateFromDocument` with `application/pdf` goes **direct to Gemini** (which supports PDF inlineData natively). Only `image/*` mime types take the OpenRouter-first vision path.
- **BYOK:** slots 5–6 need `OPENROUTER_API_KEY` like every other OpenRouter slot. Without it they throw "OPENROUTER_API_KEY is not set" and the chain falls through to direct Gemini — by design.

### Files

| File | Action | Responsibility |
|---|---|---|
| `app/study/_lib/ai/gemini.ts` | rewrite (internals only) | dual-provider chain: slots, rate limit, translators, 6 public `llm` functions |
| `app/study/_lib/ai/gemini.test.ts` | create | unit tests for pure translators + fallback-chain behavior (mocked `fetch`) |
| `app/study/api/caption/route.ts` | modify | drop direct `GoogleGenAI`; call `llm.generateFromImages` |
| `app/study/_lib/ai/logger.ts` | modify | add OpenRouter model ids to `MODEL_RATES` |
| `.env` | modify | add `OPENROUTER_API_KEY` |
| `.env.example` | create | key names only |
| `AGENTS.md` (repo root `makerpreneur/`) | modify | add `OPENROUTER_API_KEY` to env list |
| `README.md` (repo root `makerpreneur/`) | modify | mention OpenRouter gateway |

**Not changed:** `actions.ts`, `agent.ts`, `retrieve.ts`, `detect.ts`, `memory.ts`, `extract/route.ts`, `tools.ts`, all existing tests (they `vi.mock("./gemini")` the whole module — still green). `embedTexts` keeps its current implementation byte-for-byte.

---

### Task 0: Manual — register your Gemini key as BYOK on OpenRouter

No code. Do once, at your own pace (free models work without it — slots 1–4).

- [ ] **Step 1:** Go to https://openrouter.ai/workspaces/default/byok
- [ ] **Step 2:** Add your Google AI Studio key (the same value as `GEMINI_API_KEY` in `.env`).
- [ ] **Step 3:** Optionally toggle **"Always use for this provider"** so `google/*` requests never fall back to OpenRouter shared capacity.
- [ ] **Step 4:** Understand the cost: OpenRouter charges **5% of its list price, waived for the first 1M BYOK requests/month** — effectively free for this project. Requests authenticate with YOUR key; rate limits are your Google account's.

---

### Task 1: Environment — add `OPENROUTER_API_KEY`

**Files:**
- Modify: `myapp/.env` (add one line; do not commit)
- Create: `myapp/.env.example`

- [ ] **Step 1: Add to `.env`**

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get the key at https://openrouter.ai/settings/keys ("Create Key"). `.env` is gitignored — never commit it.

- [ ] **Step 2: Create `.env.example`** (repo root path `myapp/.env.example`) with key names only:

```bash
OPENROUTER_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: env.example with OPENROUTER_API_KEY"
```

---

### Task 2: TDD — write `gemini.test.ts` for the pure translation functions

**Files:**
- Test: `app/study/_lib/ai/gemini.test.ts` (create)

The translators are pure functions: `toOpenAITools`, `toOpenAIMessages`, `parseOpenAIChat`, `parseSSEChunk` (all exported from `gemini.ts`, plus `parseJsonRepair`). They do not exist yet — write the tests first, watch them fail to compile, then implement in Task 3.

> The existing test files (`agent.test.ts`, `tools.test.ts`) `vi.mock("./gemini", ...)` the whole module, so they are unaffected. This new file imports the real module — that is fine because `gemini.ts` has no top-level side effects (the Google client is created lazily inside `getClient()`).

- [ ] **Step 1: Write the failing test file** — create `app/study/_lib/ai/gemini.test.ts` with exactly this content:

```ts
import { describe, it, expect } from "vitest";
import { toOpenAITools, toOpenAIMessages, parseOpenAIChat, parseSSEChunk, parseJsonRepair } from "./gemini";

describe("toOpenAITools", () => {
  it("converts functionDeclarations into OpenAI function tools", () => {
    const geminiTools = [
      { functionDeclarations: [
        { name: "search_material", description: "Search materials", parameters: { type: "OBJECT", properties: { q: { type: "STRING" } } } },
        { name: "generate_flashcards", description: "Make cards", parameters: { type: "OBJECT", properties: {} } }
      ] }
    ];
    const out = toOpenAITools(geminiTools);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      type: "function",
      function: { name: "search_material", description: "Search materials", parameters: { type: "OBJECT", properties: { q: { type: "STRING" } } } }
    });
    expect(out[1].function.name).toBe("generate_flashcards");
  });

  it("returns [] for falsy input", () => {
    expect(toOpenAITools(undefined as any)).toEqual([]);
    expect(toOpenAITools([])).toEqual([]);
  });
});

describe("toOpenAIMessages", () => {
  it("converts plain text user messages to string content", () => {
    const out = toOpenAIMessages([{ role: "user", parts: [{ text: "hello" }] }]);
    expect(out).toEqual([{ role: "user", content: "hello" }]);
  });

  it("converts inlineData image parts to data-URL image_url content", () => {
    const out = toOpenAIMessages([
      { role: "user", parts: [
        { text: "look at this" },
        { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } }
      ] }
    ]);
    expect(out[0].content).toEqual([
      { type: "text", text: "look at this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } }
    ]);
  });

  it("converts functionCall parts to assistant tool_calls with queued ids", () => {
    const out = toOpenAIMessages([
      { role: "model", parts: [
        { functionCall: { name: "search_material", args: { q: "x" } } },
        { functionCall: { name: "translate_text", args: { text: "y", targetLanguage: "ms" } } }
      ] }
    ]);
    expect(out[0].role).toBe("assistant");
    expect(out[0].content).toBeNull();
    expect(out[0].tool_calls).toHaveLength(2);
    expect(out[0].tool_calls[0].id).toBe("call_0");
    expect(out[0].tool_calls[0].function).toEqual({ name: "search_material", arguments: '{"q":"x"}' });
    expect(out[0].tool_calls[1].id).toBe("call_1");
    expect(out[0].tool_calls[1].function.name).toBe("translate_text");
  });

  it("converts functionResponse parts to tool messages reusing queued ids in order", () => {
    const out = toOpenAIMessages([
      { role: "model", parts: [{ functionCall: { name: "search_material", args: {} } }] },
      { role: "user", parts: [{ functionResponse: { name: "search_material", response: { ok: true, result: "chunk text" } } }] }
    ]);
    expect(out[1]).toEqual({
      role: "tool",
      tool_call_id: "call_0",
      content: JSON.stringify({ ok: true, result: "chunk text" })
    });
  });

  it("maps role model -> assistant", () => {
    const out = toOpenAIMessages([{ role: "model", parts: [{ text: "hi" }] }]);
    expect(out[0].role).toBe("assistant");
  });
});

describe("parseOpenAIChat", () => {
  it("extracts text and usage", () => {
    const out = parseOpenAIChat({
      choices: [{ message: { content: "the answer" } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    }, "google/gemma-4-31b-it:free");
    expect(out.text).toBe("the answer");
    expect(out.functionCalls).toEqual([]);
    expect(out.usage).toEqual({ model: "google/gemma-4-31b-it:free", inputTokens: 10, outputTokens: 20 });
  });

  it("extracts tool_calls with JSON-parsed args", () => {
    const out = parseOpenAIChat({
      choices: [{ message: {
        content: null,
        tool_calls: [
          { id: "call_9", type: "function", function: { name: "generate_quiz", arguments: '{"topic":"physics"}' } }
        ]
      } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 }
    }, "openrouter/free");
    expect(out.text).toBe("");
    expect(out.functionCalls).toEqual([{ name: "generate_quiz", args: { topic: "physics" } }]);
  });

  it("defaults args to {} when arguments is not valid JSON", () => {
    const out = parseOpenAIChat({
      choices: [{ message: { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "t", arguments: "not-json" } }] } }],
      usage: {}
    }, "m");
    expect(out.functionCalls[0].args).toEqual({});
  });
});

describe("parseSSEChunk", () => {
  it("parses a data: JSON line", () => {
    const out = parseSSEChunk('data: {"choices":[{"delta":{"content":"hi"}}]}');
    expect(out.choices[0].delta.content).toBe("hi");
  });

  it("returns null for [DONE]", () => {
    expect(parseSSEChunk("data: [DONE]")).toBeNull();
  });

  it("returns null for non-data lines and garbage", () => {
    expect(parseSSEChunk(": keep-alive")).toBeNull();
    expect(parseSSEChunk("data: {broken")).toBeNull();
  });
});

describe("parseJsonRepair", () => {
  it("parses plain JSON", () => {
    expect(parseJsonRepair('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json code fences before parsing", () => {
    expect(parseJsonRepair('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail (module can't even import yet)**

Run: `npm test`
Expected: FAIL — `gemini.test.ts` errors: `toOpenAITools is not exported` / `Cannot find name 'toOpenAITools'`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add app/study/_lib/ai/gemini.test.ts
git commit -m "test: OpenRouter translation helpers (failing)"
```

---

### Task 3: Implement the translation layer + slot infrastructure in `gemini.ts`

**Files:**
- Modify: `app/study/_lib/ai/gemini.ts` (top of file + helpers)

- [ ] **Step 1: Read the current file** (`app/study/_lib/ai/gemini.ts`, 392 lines) end to end so the replacement below is a diff you can reason about.

- [ ] **Step 2: Replace the file header and constants** (everything from line 1 through the end of `recordQuotaError`, i.e. lines 1–50) with:

```ts
var OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

var OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type Slot = {
  provider: "openrouter" | "gemini";
  model: string;
};

// Free-first chain. Slots 1-4 are OpenRouter free endpoints; slots 5-6 route
// to Google via your OpenRouter BYOK key (Task 0); slots 7-9 are direct
// Gemini last resorts.
var TEXT_SLOTS: Slot[] = [
  { provider: "openrouter", model: "openrouter/free" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" },
  { provider: "openrouter", model: "openai/gpt-oss-20b:free" },
  { provider: "openrouter", model: "google/gemini-3.5-flash" },
  { provider: "openrouter", model: "google/gemini-3.6-flash" },
  { provider: "gemini", model: "gemini-3.6-flash" },
  { provider: "gemini", model: "gemini-3.5-flash" },
  { provider: "gemini", model: "gemini-3.5-flash-lite" }
];

var VISION_SLOTS: Slot[] = [
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" },
  { provider: "openrouter", model: "openrouter/free" },
  { provider: "gemini", model: "gemini-3.6-flash" },
  { provider: "gemini", model: "gemini-3.5-flash" }
];

var EMBED_MODELS = [
  "gemini-embedding-001",
  "text-embedding-004"
];

// Free endpoints on OpenRouter are ~20 RPM; direct Gemini is far more lenient.
var MIN_GAPS: Record<string, number> = { gemini: 0.35, openrouter: 3 };
var lastCallTime: Record<string, number> = {};
var modelCooldown: Record<string, number> = {};

function slotKey(slot: Slot): string {
  return slot.provider + ":" + slot.model;
}

function inCooldown(key: string): boolean {
  return Date.now() < (modelCooldown[key] || 0);
}

function isQuotaError(err: unknown): boolean {
  var e: any = err;
  if (e && e.status === 429) {
    return true;
  }
  return typeof e?.message === "string" && e.message.indexOf('"code":429') !== -1;
}

function recordQuotaError(key: string, err: unknown): void {
  if (!isQuotaError(err)) {
    return;
  }
  var m = String((err as any)?.message || "").match(/retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s/);
  var delayMs = m ? parseFloat(m[1]) * 1000 : 60000;
  if (delayMs < 15000) delayMs = 15000;
  if (delayMs > 120000) delayMs = 120000;
  modelCooldown[key] = Date.now() + delayMs;
  console.warn("[LLM] [COOLDOWN-SET] Slot " + key + " on cooldown for " + (delayMs / 1000).toFixed(1) + "s due to 429 quota error.");
}

async function getClient(): Promise<any> {
  var genai = await import("@google/genai");
  var client = new genai.GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
  return client;
}
```

Note: `LlmUsage` and `LlmResult` type exports (lines 52–61 of the current file) stay **unchanged** — keep them.

- [ ] **Step 3: Add the pure translation functions** — insert these right after the type definitions (after `LlmResult`, before the old `generate`):

```ts
export function toOpenAITools(geminiTools: any[]): any[] {
  if (!geminiTools) return [];
  var out: any[] = [];
  for (var i = 0; i < geminiTools.length; i++) {
    var decls = geminiTools[i].functionDeclarations || [];
    for (var j = 0; j < decls.length; j++) {
      var d = decls[j];
      out.push({ type: "function", function: { name: d.name, description: d.description, parameters: d.parameters } });
    }
  }
  return out;
}

export function toOpenAIMessages(messages: any[]): any[] {
  var out: any[] = [];
  var callIdQueue: string[] = [];
  var counter = 0;
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var parts: any[] = msg.parts || [];
    var hasFunctionCall = parts.some(function(p: any) { return p.functionCall; });
    var hasFunctionResponse = parts.some(function(p: any) { return p.functionResponse; });

    if (hasFunctionCall) {
      var toolCalls: any[] = [];
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        if (p.functionCall) {
          var id = "call_" + (counter++);
          callIdQueue.push(id);
          toolCalls.push({
            id: id,
            type: "function",
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args || {})
            }
          });
        }
      }
      out.push({ role: "assistant", content: null, tool_calls: toolCalls });
    } else if (hasFunctionResponse) {
      for (var k = 0; k < parts.length; k++) {
        var fr = parts[k].functionResponse;
        if (fr) {
          var toolCallId = callIdQueue.shift() || "call_unknown";
          out.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: typeof fr.response === "string" ? fr.response : JSON.stringify(fr.response)
          });
        }
      }
    } else {
      var content: any[] = [];
      var textBuf = "";
      for (var t = 0; t < parts.length; t++) {
        var part = parts[t];
        if (part.text) {
          textBuf += part.text;
        } else if (part.inlineData) {
          if (textBuf) { content.push({ type: "text", text: textBuf }); textBuf = ""; }
          content.push({ type: "image_url", image_url: { url: "data:" + part.inlineData.mimeType + ";base64," + part.inlineData.data } });
        }
      }
      if (textBuf) content.push({ type: "text", text: textBuf });
      out.push({ role: msg.role === "model" ? "assistant" : "user", content: content });
    }
  }
  return out;
}

export function parseOpenAIChat(data: any, model: string): { text: string; functionCalls: any[]; usage: LlmUsage } {
  var msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
  var functionCalls: any[] = [];
  if (Array.isArray(msg.tool_calls)) {
    for (var i = 0; i < msg.tool_calls.length; i++) {
      var tc = msg.tool_calls[i];
      var args: any = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) { args = {}; }
      functionCalls.push({ name: tc.function.name, args: args });
    }
  }
  var usage: LlmUsage = {
    model: model,
    inputTokens: (data.usage && data.usage.prompt_tokens) || 0,
    outputTokens: (data.usage && data.usage.completion_tokens) || 0
  };
  return { text: typeof msg.content === "string" ? msg.content : "", functionCalls: functionCalls, usage: usage };
}

export function parseSSEChunk(raw: string): any | null {
  var s = raw.trim();
  if (s.indexOf("data:") !== 0) return null;
  var payload = s.slice(5).trim();
  if (payload === "[DONE]") return null;
  try { return JSON.parse(payload); } catch (e) { return null; }
}

export function parseJsonRepair(text: string): any {
  var t = (text || "").trim();
  try { return JSON.parse(t); } catch (e) { /* fall through to fence-strip */ }
  if (t.indexOf("```") === 0) {
    t = t.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }
  return JSON.parse(t);
}
```

- [ ] **Step 4: Add the shared chain runner and slot rate-limit helpers** — insert after `parseJsonRepair`. Names are `slotRateLimit` / `slotTrackCall` to avoid colliding with the existing `rateLimit(model)` / `trackCall(model, task)` (lines ~320-338 of the current file), which `embedTexts` still uses and must keep:

```ts
async function slotRateLimit(key: string, gapMs: number): Promise<void> {
  var now = Date.now();
  var lastCall = lastCallTime[key] || 0;
  var waitMs = gapMs - (now - lastCall);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

function slotTrackCall(key: string): void {
  lastCallTime[key] = Date.now();
}

async function runSlotChain<T>(
  slots: Slot[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean; tools?: any[]; task?: string },
  driver: (slot: Slot, opts: any) => Promise<{ value: T; usage: LlmUsage }>
): Promise<{ value: T; usage: LlmUsage }> {
  var lastError: unknown = null;
  var taskName = opts.task || "chain";
  var startTime = Date.now();

  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];
    var key = slotKey(slot);
    if (inCooldown(key)) {
      console.log("[LLM] [COOLDOWN-SKIP] Slot " + key + " is on cooldown, skipping...");
      continue;
    }
    try {
      var gap = MIN_GAPS[slot.provider];
      await slotRateLimit(key, gap);
      console.log("[LLM] [TRY " + (i + 1) + "/" + slots.length + "] slot=" + key + " task=" + taskName);
      var out = await driver(slot, opts);
      slotTrackCall(key);
      console.log("[LLM] [SUCCESS] slot=" + key + " task=" + taskName + " tokens(in=" + out.usage.inputTokens + ", out=" + out.usage.outputTokens + ") duration=" + (Date.now() - startTime) + "ms");
      return out;
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(key, err);
      var errMsg = err instanceof Error ? err.message : String(err);
      console.error("[LLM] [ERROR] slot=" + key + " task=" + taskName + " failed: " + errMsg);
      if (i < slots.length - 1) {
        console.log("[LLM] [FALLBACK] " + key + " -> " + slots[i + 1].provider + ":" + slots[i + 1].model);
      }
    }
  }
  console.error("[LLM] [EXHAUSTED] All slots failed for task=" + taskName + ". Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}

// --- OpenRouter (OpenAI-compatible) driver ---------------------------------

async function openRouterChat(model: string, messages: any[], opts: { temperature?: number; maxTokens?: number; json?: boolean; tools?: any[]; stream?: boolean } = {}): Promise<any> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  var body: Record<string, unknown> = {
    model: model,
    messages: messages,
    temperature: typeof opts.temperature === "number" ? opts.temperature : 0.3
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }
  if (opts.stream) body.stream = true;
  var res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://study-hub.local",
      "X-Title": "Makerpreneur Study Hub"
    },
    body: JSON.stringify(body)
  });
  if (opts.stream) {
    if (!res.ok || !res.body) {
      var errData0: any = null;
      try { errData0 = await res.json(); } catch (e) { /* ignore */ }
      var errMsg0 = (errData0 && errData0.error && errData0.error.message) || ("OpenRouter HTTP " + res.status);
      var e0: any = new Error(errMsg0);
      e0.status = res.status;
      throw e0;
    }
    return res;
  }
  var data: any = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    var errMsg = (data && data.error && data.error.message) || ("OpenRouter HTTP " + res.status);
    var err: any = new Error(errMsg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// --- Gemini direct driver ----------------------------------------------------

async function geminiDriver(slot: Slot, messages: any[], opts: any): Promise<{ value: any; usage: LlmUsage }> {
  var client = await getClient();
  var config: any = { temperature: typeof opts.temperature === "number" ? opts.temperature : 0.3 };
  if (opts.maxTokens) config.maxOutputTokens = opts.maxTokens;
  if (opts.json) config.responseMimeType = "application/json";
  if (opts.tools && opts.tools.length > 0) config.tools = opts.tools;
  var response = await client.models.generateContent({ model: slot.model, contents: messages, config: config });
  var usage: LlmUsage = {
    model: slot.model,
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0
  };
  if (opts.tools && opts.tools.length > 0) {
    var parts = (response.candidates?.[0]?.content?.parts || []).filter(function(p: any) { return p.functionCall; });
    var calls = (response.functionCalls || []).map(function(c: any, idx: number) {
      return { name: c.name, args: c.args, thoughtSignature: parts[idx] && parts[idx].thoughtSignature };
    });
    return { value: { text: calls.length > 0 ? "" : (response.text || ""), functionCalls: calls }, usage: usage };
  }
  if (opts.json) return { value: parseJsonRepair(response.text || ""), usage: usage };
  return { value: response.text || "", usage: usage };
}
```

- [ ] **Step 5: Run the Task 2 tests — they must pass now**

Run: `npm test`
Expected: PASS — all 11 cases in `gemini.test.ts` pass; the existing suites (`agent.test.ts`, `tools.test.ts`, `logger.test.ts`, `retrieve.test.ts`) mock `./gemini` entirely and are unaffected by the additions so far.

- [ ] **Step 6: Commit**

```bash
git add app/study/_lib/ai/gemini.ts app/study/_lib/ai/gemini.test.ts
git commit -m "feat: OpenRouter translation layer and slot chain infrastructure"
```

---

### Task 4: Rewire `generate`, `generateJson`, `generateContent` onto the slot chain

**Files:**
- Modify: `app/study/_lib/ai/gemini.ts`

- [ ] **Step 1: Replace the whole `generate` function** (the current `async function generate(prompt, temperature, maxTokens, task)` body, ~49 lines) with:

```ts
async function generate(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<LlmResult<string>> {
  var openAiMessages = [{ role: "user", content: prompt }];
  return runSlotChain<string>(TEXT_SLOTS, { temperature: temperature, maxTokens: maxTokens, task: task || "generate" }, function(slot: Slot) {
    if (slot.provider === "openrouter") {
      return openRouterChat(slot.model, openAiMessages, { temperature: temperature, maxTokens: maxTokens }).then(function(data: any) {
        var parsed = parseOpenAIChat(data, slot.model);
        return { value: parsed.text, usage: parsed.usage };
      });
    }
    return geminiDriver(slot, [{ role: "user", parts: [{ text: prompt }] }], { temperature: temperature, maxTokens: maxTokens });
  });
}
```

- [ ] **Step 2: Replace the whole `generateJson` function** (~62 lines) with:

```ts
async function generateJson(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<LlmResult<any>> {
  var openAiMessages = [{ role: "user", content: prompt }];
  return runSlotChain<any>(TEXT_SLOTS, { temperature: temperature, maxTokens: maxTokens, json: true, task: task || "generateJson" }, function(slot: Slot) {
    if (slot.provider === "openrouter") {
      return openRouterChat(slot.model, openAiMessages, { temperature: temperature, maxTokens: maxTokens, json: true }).then(function(data: any) {
        var parsed = parseOpenAIChat(data, slot.model);
        return { value: parseJsonRepair(parsed.text), usage: parsed.usage };
      });
    }
    return geminiDriver(slot, [{ role: "user", parts: [{ text: prompt }] }], { temperature: temperature, maxTokens: maxTokens, json: true });
  });
}
```

- [ ] **Step 3: Replace the whole `generateContent` function** (~64 lines) with:

```ts
async function generateContent(
  messages: any[],
  opts: { tools?: any; temperature?: number; task?: string } = {}
): Promise<{ text: string; functionCalls: any[]; usage: LlmUsage }> {
  var temp = typeof opts.temperature === "number" ? opts.temperature : 0.3;
  var openAiMessages = toOpenAIMessages(messages);
  var out = await runSlotChain<any>(TEXT_SLOTS, { temperature: temp, tools: opts.tools, task: opts.task || "generateContent" }, function(slot: Slot) {
    if (slot.provider === "openrouter") {
      return openRouterChat(slot.model, openAiMessages, { temperature: temp, tools: toOpenAITools(opts.tools) }).then(function(data: any) {
        var parsed = parseOpenAIChat(data, slot.model);
        return { value: parsed, usage: parsed.usage };
      });
    }
    return geminiDriver(slot, messages, { temperature: temp, tools: opts.tools });
  });
  var v: any = out.value;
  return { text: v.text || "", functionCalls: v.functionCalls || [], usage: out.usage };
}
```

- [ ] **Step 4: Keep the old `rateLimit(model)` / `trackCall(model, task)` / `sleep` helpers as-is.** They are still used by `embedTexts` (until the end of the file) and the old `generateFromDocument` (until Task 6 replaces it). Do NOT delete them — only the three rewritten functions (`generate`, `generateJson`, `generateContent`) now route through the slot chain; `embedTexts` stays on direct Gemini unchanged.

- [ ] **Step 5: Verify the whole repo compiles again**

Run: `npx tsc --noEmit`
Expected: PASS — `agent.ts`, `actions.ts`, `retrieve.ts`, `detect.ts`, `memory.ts` all consume the same `llm` shapes as before.

Run: `npm test`
Expected: PASS — all suites incl. the previously-failing `agent.test.ts`, `tools.test.ts` (they mock `./gemini`), plus `gemini.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/study/_lib/ai/gemini.ts
git commit -m "feat: route generate, generateJson, generateContent through OpenRouter-first slot chain"
```

---

### Task 5: Rewire `generateContentStream` (SSE parsing)

**Files:**
- Modify: `app/study/_lib/ai/gemini.ts`

- [ ] **Step 1: Replace the whole `generateContentStream` function** (~50 lines) with:

```ts
async function* generateContentStream(
  messages: any[],
  opts: { temperature?: number; task?: string; onUsage?: (usage: LlmUsage) => void } = {}
): AsyncGenerator<string, void, unknown> {
  var onUsage = opts.onUsage;
  var temp = typeof opts.temperature === "number" ? opts.temperature : 0.3;
  var task = opts.task || "generateContentStream";
  var lastError: unknown = null;
  var openAiMessages = toOpenAIMessages(messages);

  for (var i = 0; i < TEXT_SLOTS.length; i++) {
    var slot = TEXT_SLOTS[i];
    var key = slotKey(slot);
    if (inCooldown(key)) continue;
    try {
      var gap = MIN_GAPS[slot.provider];
      await slotRateLimit(key, gap);
      console.log("[LLM] trying " + key + " stream (" + task + ")");
      slotTrackCall(key);

      if (slot.provider === "openrouter") {
        var res = await openRouterChat(slot.model, openAiMessages, { temperature: temp, stream: true });
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        var usageReported = false;
        while (true) {
          var read = await reader.read();
          if (read.done) break;
          buffer += decoder.decode(read.value, { stream: true });
          var lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (var li = 0; li < lines.length; li++) {
            var parsed = parseSSEChunk(lines[li]);
            if (!parsed) continue;
            if (parsed.error) {
              var e1: any = new Error(parsed.error.message || "OpenRouter stream error");
              e1.status = 500;
              throw e1;
            }
            if (parsed.usage && !usageReported) {
              usageReported = true;
              if (onUsage) {
                onUsage({ model: slot.model, inputTokens: parsed.usage.prompt_tokens || 0, outputTokens: parsed.usage.completion_tokens || 0 });
              }
            }
            var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            if (delta && typeof delta.content === "string" && delta.content !== "") {
              yield delta.content;
            }
          }
        }
        return;
      } else {
        var client = await getClient();
        var responseStream = await client.models.generateContentStream({
          model: slot.model,
          contents: messages,
          config: { temperature: temp }
        });
        var usageReportedGemini = false;
        for await (var chunk of responseStream) {
          if (!usageReportedGemini && chunk.usageMetadata) {
            usageReportedGemini = true;
            if (onUsage) {
              onUsage({
                model: slot.model,
                inputTokens: chunk.usageMetadata.promptTokenCount || 0,
                outputTokens: chunk.usageMetadata.candidatesTokenCount || 0
              });
            }
          }
          if (chunk.text) {
            yield chunk.text;
          }
        }
        return;
      }
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(key, err);
      console.error("[LLM] " + key + " stream failed (" + task + "):", err);
    }
  }
  console.error("[LLM] All slots exhausted for generateContentStream (" + task + "). Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm test` → PASS (agent.test.ts streams via the mocked module, unchanged)

- [ ] **Step 3: Commit**

```bash
git add app/study/_lib/ai/gemini.ts
git commit -m "feat: stream final answers through OpenRouter SSE with slot fallback"
```

---

### Task 6: Vision — `generateFromImages`, `generateFromDocument`, caption route

**Files:**
- Modify: `app/study/_lib/ai/gemini.ts`
- Modify: `app/study/api/caption/route.ts`

- [ ] **Step 1: Add `import type { GeminiImagePart } from "../chat-images";`** at the top of `gemini.ts` (next to the other imports; note `agent.ts` uses the same relative path pattern).

- [ ] **Step 2: Add `generateFromImages`** after `geminiDriver` (it reuses `geminiDriver` with a temperature/maxTokens override for both providers; no separate vision helper needed):

```ts
async function generateFromImages(
  images: GeminiImagePart[],
  prompt: string,
  task: string = "generateFromImages"
): Promise<string> {
  var openAiContent: any[] = [];
  for (var i = 0; i < images.length; i++) {
    openAiContent.push({ type: "image_url", image_url: { url: "data:" + images[i].inlineData.mimeType + ";base64," + images[i].inlineData.data } });
  }
  openAiContent.push({ type: "text", text: prompt });
  var openAiMessages = [{ role: "user", content: openAiContent }];
  var geminiParts = images.map(function(im: GeminiImagePart) { return { inlineData: im.inlineData }; }).concat([{ text: prompt }]);

  var out = await runSlotChain<string>(VISION_SLOTS, { temperature: 0.2, maxTokens: 300, task: task }, function(slot: Slot) {
    if (slot.provider === "openrouter") {
      return openRouterChat(slot.model, openAiMessages, { temperature: 0.2, maxTokens: 300 }).then(function(data: any) {
        var parsed = parseOpenAIChat(data, slot.model);
        return { value: parsed.text, usage: parsed.usage };
      });
    }
    return geminiDriver(slot, [{ role: "user", parts: geminiParts }], { temperature: 0.2, maxTokens: 300 });
  });
  return out.value;
}
```

- [ ] **Step 3: Replace the whole `generateFromDocument` function** (~42 lines) with:

```ts
async function generateFromDocument(
  fileBuffer: Uint8Array | Buffer,
  prompt: string,
  mimeType: string = "application/pdf",
  task: string | null = "generateFromDocument"
): Promise<string> {
  var base64Data = Buffer.from(fileBuffer).toString("base64");
  // OpenRouter free models accept images only, not PDF data URLs.
  if (mimeType.indexOf("image/") === 0) {
    return generateFromImages([{ inlineData: { mimeType: mimeType, data: base64Data } }], prompt, task || "generateFromDocument");
  }
  // PDFs: direct Gemini only (native inlineData support).
  var geminiSlots = TEXT_SLOTS.filter(function(s: Slot) { return s.provider === "gemini"; });
  var lastError: unknown = null;
  for (var i = 0; i < geminiSlots.length; i++) {
    var slot = geminiSlots[i];
    var key = slotKey(slot);
    if (inCooldown(key)) continue;
    try {
      await slotRateLimit(key, MIN_GAPS.gemini);
      slotTrackCall(key);
      var out = await geminiDriver(slot, [
        { role: "user", parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt }
        ] }
      ], { temperature: 0.2, maxTokens: 8192 });
      return out.value;
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(key, err);
      console.error("[LLM] " + key + " failed (" + (task || "generateFromDocument") + "):", err);
    }
  }
  console.error("[LLM] All slots exhausted for generateFromDocument. Last error:", lastError);
  throw new Error("AI Vision service is temporarily unavailable. Please try again later.");
}
```

- [ ] **Step 4: Replace the whole `caption/route.ts`** (52 lines) with:

```ts
import { llm } from "../../_lib/ai/gemini";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { downloadImageParts } from "../../_lib/chat-images";

// ponytail: single provider-chain attempt; failure degrades to default
// caption, never blocks the chat stream (called fire-and-forget from client).
export async function POST(request: Request) {
  try {
    var body = await request.json();
    var paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    if (paths.length === 0) {
      return Response.json({ captions: paths.map(function() { return "User uploaded image"; }) });
    }

    var supabase = await createServerSupabaseClient();
    var imageParts = await downloadImageParts(supabase, paths);

    var text = await llm.generateFromImages(
      imageParts,
      "Describe each of the " + paths.length + " images in one short sentence (max 15 words). Output ONLY the descriptions, one per line, in the same order as the images. No numbering or labels.",
      "caption"
    );
    var lines = text.split("\n").map(function(l: string) { return l.trim(); }).filter(function(l: string) { return l !== ""; });
    var captions: string[] = [];
    for (var j = 0; j < paths.length; j++) {
      captions.push(lines[j] || "User uploaded image");
    }
    return Response.json({ captions: captions });
  } catch (err) {
    console.error("[CAPTION] route error:", err);
    return Response.json({ captions: [] });
  }
}
```

Note the old route silently returned default captions when `GEMINI_API_KEY` was empty; the new one falls through the chain instead and returns `captions: []` on total failure — acceptable, it is a fire-and-forget enhancement path.

- [ ] **Step 5: Add `generateFromImages` to the `llm` export object** (the existing `export var llm = {...}` at the bottom of `gemini.ts` — insert `generateFromImages: generateFromImages,` alongside the other entries; `generateFromDocument` already exported).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → PASS
Run: `npm run lint` → PASS (no unused imports: `GoogleGenAI` is gone from caption route)
Run: `npm test` → PASS

- [ ] **Step 7: Commit**

```bash
git add app/study/_lib/ai/gemini.ts app/study/api/caption/route.ts
git commit -m "feat: vision via OpenRouter-first chain; caption route drops direct GoogleGenAI"
```

---

### Task 7: Cost table — `logger.ts` `MODEL_RATES`

**Files:**
- Modify: `app/study/_lib/ai/logger.ts`

`usage.model` now contains OpenRouter ids (`openrouter/free`, `google/gemma-4-31b-it:free`, ...), BYOK ids (`google/gemini-3.5-flash`, `google/gemini-3.6-flash`), or plain Gemini ids. `estimateCostUs` falls back to the `default` entry for unknown keys, so free models would wrongly bill at the default rate. Fix the table.

- [ ] **Step 1: Replace the `MODEL_RATES` object** (currently keys `gemini-3.6-flash`, etc. — keep those, add the rest) with:

```ts
const MODEL_RATES: Record<string, { in: number; out: number }> = {
  // OpenRouter free endpoints
  "openrouter/free": { in: 0, out: 0 },
  "google/gemma-4-31b-it:free": { in: 0, out: 0 },
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": { in: 0, out: 0 },
  "openai/gpt-oss-20b:free": { in: 0, out: 0 },
  // Gemini via OpenRouter BYOK: 5% of OR list price, waived first 1M req/mo
  "google/gemini-3.6-flash": { in: 0.01, out: 0.04 },
  "google/gemini-3.5-flash": { in: 0.02, out: 0.08 },
  // Direct Gemini (existing entries unchanged)
  "gemini-3.6-flash": { in: 0.15, out: 0.6 },   // USD per 1M tokens
  "gemini-3.5-flash": { in: 0.3, out: 1.2 },
  "gemini-3.5-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-3.1-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-2.5-pro":   { in: 1.25, out: 10.0 },
  "gemini-2.5-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-2.5-flash": { in: 0.15, out: 0.6 },
  default:            { in: 0.3, out: 1.2 },
};
```

- [ ] **Step 2: Verify**

Run: `npm test` → PASS (existing `logger.test.ts` must still pass — check its assertions against the default fallback)
Run: `npm run build` → PASS

- [ ] **Step 3: Commit**

```bash
git add app/study/_lib/ai/logger.ts
git commit -m "feat: cost table for OpenRouter free and BYOK models"
```

---

### Task 8: Docs — root `AGENTS.md` + `README.md`

**Files:**
- Modify: `makerpreneur/AGENTS.md`
- Modify: `makerpreneur/README.md`

- [ ] **Step 1: `AGENTS.md`** — in the "## Env" section, replace the key list line with:

```markdown
Keys (names only, in `.env`, gitignored; `.env.example` has no values): `OPENROUTER_API_KEY` (primary LLM gateway, free models), `GEMINI_API_KEY` (fallback + embeddings), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
```

- [ ] **Step 2: `README.md`** — in the tech-stack section, add one line:

```markdown
- LLM gateway: OpenRouter (free model chain, your Gemini key via BYOK) with direct Gemini fallback; embeddings via Gemini.
```

- [ ] **Step 3: Commit**

```bash
git add ../AGENTS.md ../README.md
git commit -m "docs: OpenRouter gateway in env list and tech stack"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Static checks**

Run: `npm run lint` → clean
Run: `npx tsc --noEmit` → clean
Run: `npm run build` → clean
Run: `npm test` → all pass (6 suites incl. `gemini.test.ts`)
Run: `npm run analyze-logs` → sensible output or a clean "no log entries yet" skip

- [ ] **Step 2: Live smoke (requires `.env` keys; run `npm run dev`)**

| # | Action | Expected |
|---|---|---|
| 1 | Chat "What is Newton's second law?" (no tools) | Answer streams via a free model; dev console shows `slot=openrouter:openrouter/free [SUCCESS]` (or the next slot if that one 429s) |
| 2 | Chat "Make me 5 flashcards on photosynthesis" | Tool activity chips appear; deck link returned; `toOpenAITools` path exercised (`[TOOL-CALLS]` log) |
| 3 | Chat "Am I ready for my exam?" | Readiness gauge card renders (multi-call turn works through OpenAI `tool` messages) |
| 4 | Upload an image in chat | Caption appears under the image (vision path: `generateFromImages`); if no free vision model is up, chain falls to Gemini |
| 5 | Upload a scanned PDF to a subject | Extract still works (PDF goes direct Gemini) |

- [ ] **Step 3: Quota drill** — verify the fallback chain end to end:

1. Temporarily remove `OPENROUTER_API_KEY` from `.env`, restart `npm run dev`.
2. Chat any question → slots 1–6 throw "OPENROUTER_API_KEY is not set" and the chain lands on direct `gemini:gemini-3.6-flash`; answer still streams.
3. Restore the key, restart.

- [ ] **Step 4: Result**

No new commits in this task. Report the smoke-table results in the session.

---

## Self-review notes

- **Spec coverage:** Task 0 = BYOK registration; Task 1 = env; Tasks 2–5 = text/JSON/tools/streaming; Task 6 = vision (document + caption); Task 7 = cost accounting; Task 8 = docs; Task 9 = verification incl. quota drill. Embeddings deliberately excluded from the gateway (OpenRouter has no embedding models).
- **Type consistency:** `toOpenAITools` / `toOpenAIMessages` / `parseOpenAIChat` / `parseSSEChunk` / `parseJsonRepair` are written in Task 2's tests, defined in Task 3, and reused with identical signatures in Tasks 4–6. `generateFromImages(images: GeminiImagePart[], prompt: string, task: string)` is defined in Task 6 and consumed by the caption route in the same task. `usage.model` format (OpenRouter id vs plain gemini id) matches the `MODEL_RATES` keys added in Task 7.
- **Known risk:** free endpoints 429 frequently and occasionally drop tool-calling support; the slot chain + cooldown + existing legacy RAG fallback in `api/chat/route.ts` absorb both. If a specific free model misbehaves, remove it from `TEXT_SLOTS` — no other code changes needed.
