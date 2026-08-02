import type { GeminiImagePart } from "../chat-images";

var OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

var OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Slot = {
  provider: "openrouter" | "gemini";
  model: string;
};
// Free-first chain, ordered by bench speed (scripts/bench-openrouter.ts).
// Slots 1-6 are OpenRouter (free + BYOK); slots 7+ are direct Gemini fallbacks.
var TEXT_SLOTS: Slot[] = [
  { provider: "openrouter", model: "openrouter/free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" },
  { provider: "openrouter", model: "google/gemini-3.6-flash" },
  { provider: "openrouter", model: "google/gemini-3.5-flash" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "openai/gpt-oss-20b:free" },
  { provider: "gemini", model: "gemini-3.6-flash" },
  { provider: "gemini", model: "gemini-3.5-flash" },
  { provider: "gemini", model: "gemini-3.5-flash-lite" },
  { provider: "gemini", model: "gemini-3.1-flash-lite" },
  { provider: "gemini", model: "gemini-2.5-flash" }
];

var VISION_SLOTS: Slot[] = ([
  { provider: "openrouter", model: "openrouter/free" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" }
] as Slot[]).concat(TEXT_SLOTS.filter(function(s: Slot) { return s.provider === "gemini"; }));

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

export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type LlmResult<T> = {
  value: T;
  usage: LlmUsage;
};

// --- Translation helpers (Gemini format <-> OpenAI format) ------------------

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
      if (content.length === 0) {
        out.push({ role: msg.role === "model" ? "assistant" : "user", content: textBuf });
      } else {
        if (textBuf) content.push({ type: "text", text: textBuf });
        out.push({ role: msg.role === "model" ? "assistant" : "user", content: content });
      }
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

// --- Slot chain runners ----------------------------------------------------

async function slotRateLimit(key: string, gapMs: number): Promise<void> {
  var now = Date.now();
  var lastCall = lastCallTime[key] || 0;
  var waitMs = gapMs * 1000 - (now - lastCall);
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
      var gap = MIN_GAPS[slot.provider] || 0.35;
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

// --- Core exported LLM methods ----------------------------------------------

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

async function generateJson(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null,
  preferredModel: string | null = null
): Promise<LlmResult<any>> {
  var openAiMessages = [{ role: "user", content: prompt }];
  var slots = TEXT_SLOTS;
  if (preferredModel) {
    slots = TEXT_SLOTS.filter(function(s) { return s.model === preferredModel; })
      .concat(TEXT_SLOTS.filter(function(s) { return s.model !== preferredModel; }));
  }
  return runSlotChain<any>(slots, { temperature: temperature, maxTokens: maxTokens, json: true, task: task || "generateJson" }, function(slot: Slot) {
    if (slot.provider === "openrouter") {
      return openRouterChat(slot.model, openAiMessages, { temperature: temperature, maxTokens: maxTokens, json: true }).then(function(data: any) {
        var parsed = parseOpenAIChat(data, slot.model);
        return { value: parseJsonRepair(parsed.text), usage: parsed.usage };
      });
    }
    return geminiDriver(slot, [{ role: "user", parts: [{ text: prompt }] }], { temperature: temperature, maxTokens: maxTokens, json: true });
  });
}

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
      var gap = MIN_GAPS[slot.provider] || 0.35;
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

async function embedTexts(texts: string[]): Promise<number[][]> {
  var client = await getClient();
  var lastError: unknown = null;
  for (var i = 0; i < EMBED_MODELS.length; i++) {
    var model = EMBED_MODELS[i];
    try {
      await slotRateLimit(model, MIN_GAPS.gemini);
      var response = await client.models.embedContent({
        model: model,
        contents: texts,
        config: {
          outputDimensionality: 768
        }
      });
      slotTrackCall(model);
      return response.embeddings.map(function(e: any) {
        return e.values;
      });
    } catch (err: unknown) {
      lastError = err;
      console.error("[GEMINI] embedContent " + model + " failed:", err);
    }
  }
  console.error("[GEMINI] All embedding models exhausted. Last error:", lastError);
  throw new Error("AI embedding service is temporarily unavailable. Please try again later.");
}

async function sleep(ms: number): Promise<void> {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

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
  var geminiParts: any[] = images.map(function(im: GeminiImagePart) { return { inlineData: im.inlineData }; });
  geminiParts.push({ text: prompt });

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

export var llm = {
  generate: generate,
  generateJson: generateJson,
  generateContent: generateContent,
  generateContentStream: generateContentStream,
  embedTexts: embedTexts,
  generateFromDocument: generateFromDocument,
  generateFromImages: generateFromImages
};
