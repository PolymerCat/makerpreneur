var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function getClient(): Promise<any> {
  var genai = await import("@google/genai");
  var client = new genai.GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
  return client;
}

var MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash"
];

var EMBED_MODELS = [
  "gemini-embedding-001",
  "text-embedding-004"
];

var MIN_GAP = 0.35;
var lastCallTime: Record<string, number> = {};
var modelCooldown: Record<string, number> = {};

function inCooldown(model: string): boolean {
  return Date.now() < (modelCooldown[model] || 0);
}

function isQuotaError(err: unknown): boolean {
  var e: any = err;
  if (e && e.status === 429) {
    return true;
  }
  return typeof e?.message === "string" && e.message.indexOf('"code":429') !== -1;
}

function recordQuotaError(model: string, err: unknown): void {
  if (!isQuotaError(err)) {
    return;
  }
  var m = String((err as any)?.message || "").match(/retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s/);
  var delayMs = m ? parseFloat(m[1]) * 1000 : 60000;
  if (delayMs < 15000) delayMs = 15000;
  if (delayMs > 120000) delayMs = 120000;
  modelCooldown[model] = Date.now() + delayMs;
  console.warn("[GEMINI] [COOLDOWN-SET] Model " + model + " placed on cooldown for " + (delayMs / 1000).toFixed(1) + "s due to 429 quota error.");
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

async function generate(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<LlmResult<string>> {
  var client = await getClient();
  var lastError: unknown = null;
  var taskName = task || "generate";
  var startTime = Date.now();

  for (var i = 0; i < MODELS.length; i++) {
    var model = MODELS[i];
    if (inCooldown(model)) {
      console.log("[GEMINI] [COOLDOWN-SKIP] Model " + model + " is on cooldown, skipping...");
      continue;
    }
    try {
      console.log("[GEMINI] [TRY " + (i + 1) + "/" + MODELS.length + "] model=" + model + " task=" + taskName);
      await rateLimit(model);
      var response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: temperature,
          maxOutputTokens: maxTokens
        }
      });
      trackCall(model, task);
      var usage: LlmUsage = {
        model: model,
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0
      };
      console.log("[GEMINI] [SUCCESS] model=" + model + " task=" + taskName + " tokens(in=" + usage.inputTokens + ", out=" + usage.outputTokens + ") duration=" + (Date.now() - startTime) + "ms");
      return { value: response.text || "", usage: usage };
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(model, err);
      var errMsg = err instanceof Error ? err.message : String(err);
      console.error("[GEMINI] [ERROR] model=" + model + " task=" + taskName + " failed: " + errMsg);
      if (i < MODELS.length - 1) {
        console.log("[GEMINI] [FALLBACK] Triggering fallback from " + model + " -> " + MODELS[i + 1]);
      }
    }
  }
  console.error("[GEMINI] [EXHAUSTED] All models failed for task=" + taskName + ". Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}

async function generateJson(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null,
  preferredModel: string | null = null
): Promise<LlmResult<any>> {
  var client = await getClient();
  var lastError: unknown = null;
  var taskName = task || "generateJson";
  var startTime = Date.now();
  var models = preferredModel ? [preferredModel].concat(MODELS.filter(function(m) { return m !== preferredModel; })) : MODELS;

  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    if (inCooldown(model)) {
      console.log("[GEMINI] [COOLDOWN-SKIP] Model " + model + " is on cooldown, skipping...");
      continue;
    }
    try {
      console.log("[GEMINI] [TRY " + (i + 1) + "/" + models.length + "] model=" + model + " task=" + taskName);
      await rateLimit(model);
      var response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json"
        }
      });
      trackCall(model, task);
      var usage: LlmUsage = {
        model: model,
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0
      };
      var text = (response.text || "").trim();
      var parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (_e) {
        console.log("[GEMINI] [JSON-REPAIR] Raw JSON parse failed, stripping codeblock markdown...");
        if (text.startsWith("```")) {
          text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        }
        parsed = JSON.parse(text);
      }
      console.log("[GEMINI] [SUCCESS] model=" + model + " task=" + taskName + " tokens(in=" + usage.inputTokens + ", out=" + usage.outputTokens + ") duration=" + (Date.now() - startTime) + "ms");
      return { value: parsed, usage: usage };
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(model, err);
      var errMsg = err instanceof Error ? err.message : String(err);
      console.error("[GEMINI] [ERROR] model=" + model + " task=" + taskName + " failed: " + errMsg);
      if (i < models.length - 1) {
        console.log("[GEMINI] [FALLBACK] Triggering fallback from " + model + " -> " + models[i + 1]);
      }
    }
  }
  console.error("[GEMINI] [EXHAUSTED] All models failed for task=" + taskName + ". Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}

async function generateContent(
  messages: any[],
  opts: { tools?: any; temperature?: number; task?: string } = {}
): Promise<{ text: string; functionCalls: any[]; usage: LlmUsage }> {
  var client = await getClient();
  var lastError: unknown = null;
  var temp = typeof opts.temperature === "number" ? opts.temperature : 0.3;
  var taskName = opts.task || "generateContent";
  var startTime = Date.now();

  for (var i = 0; i < MODELS.length; i++) {
    var model = MODELS[i];
    if (inCooldown(model)) {
      console.log("[GEMINI] [COOLDOWN-SKIP] Model " + model + " is on cooldown, skipping...");
      continue;
    }
    try {
      console.log("[GEMINI] [TRY " + (i + 1) + "/" + MODELS.length + "] model=" + model + " task=" + taskName);
      await rateLimit(model);
      var config: any = { temperature: temp };
      if (opts.tools) {
        config.tools = opts.tools;
      }
      var response = await client.models.generateContent({
        model: model,
        contents: messages,
        config: config
      });
      trackCall(model, taskName);

      var usage: LlmUsage = {
        model: model,
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0
      };

      var parts = (response.candidates?.[0]?.content?.parts || []).filter(function(p: any) {
        return p.functionCall;
      });
      var calls = (response.functionCalls || []).map(function(c: any, i: number) {
        return { name: c.name, args: c.args, thoughtSignature: parts[i] && parts[i].thoughtSignature };
      });
      var text = calls.length > 0 ? "" : (response.text || "");

      console.log("[GEMINI] [SUCCESS] model=" + model + " task=" + taskName + " toolCalls=" + calls.length + " textLength=" + text.length + " tokens(in=" + usage.inputTokens + ", out=" + usage.outputTokens + ") duration=" + (Date.now() - startTime) + "ms");

      return {
        text: text,
        functionCalls: calls,
        usage: usage
      };
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(model, err);
      var errMsg = err instanceof Error ? err.message : String(err);
      console.error("[GEMINI] [ERROR] model=" + model + " task=" + taskName + " failed: " + errMsg);
      if (i < MODELS.length - 1) {
        console.log("[GEMINI] [FALLBACK] Triggering fallback from " + model + " -> " + MODELS[i + 1]);
      }
    }
  }
  console.error("[GEMINI] [EXHAUSTED] All models failed for task=" + taskName + ". Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}

async function* generateContentStream(
  messages: any[],
  opts: { temperature?: number; task?: string; onUsage?: (usage: LlmUsage) => void } = {}
): AsyncGenerator<string, void, unknown> {
  var client = await getClient();
  var lastError: unknown = null;
  var temp = typeof opts.temperature === "number" ? opts.temperature : 0.3;
  var task = opts.task || "generateContentStream";

  for (var i = 0; i < MODELS.length; i++) {
    var model = MODELS[i];
    if (inCooldown(model)) continue;
    try {
      console.log("[GEMINI] trying " + model + " stream (" + task + ")");
      await rateLimit(model);
      var responseStream = await client.models.generateContentStream({
        model: model,
        contents: messages,
        config: {
          temperature: temp
        }
      });
      trackCall(model, task);

      var usageReported = false;
      for await (var chunk of responseStream) {
        if (!usageReported && chunk.usageMetadata) {
          usageReported = true;
          if (opts.onUsage) {
            opts.onUsage({
              model: model,
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
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(model, err);
      console.error("[GEMINI] " + model + " stream failed (" + task + "):", err);
    }
  }
  console.error("[GEMINI] All models exhausted for generateContentStream (" + task + "). Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  var client = await getClient();
  var lastError: unknown = null;
  for (var i = 0; i < EMBED_MODELS.length; i++) {
    var model = EMBED_MODELS[i];
    try {
      await rateLimit(model);
      var response = await client.models.embedContent({
        model: model,
        contents: texts,
        config: {
          outputDimensionality: 768
        }
      });
      trackCall(model, "embed");
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

async function rateLimit(model: string): Promise<void> {
  var now = Date.now();
  var lastCall = lastCallTime[model] || 0;
  var elapsed = now - lastCall;
  var waitMs = MIN_GAP * 1000 - elapsed;
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

function trackCall(model: string, task: string | null): void {
  lastCallTime[model] = Date.now();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

async function generateFromDocument(
  fileBuffer: Uint8Array | Buffer,
  prompt: string,
  mimeType: string = "application/pdf",
  task: string | null = "generateFromDocument"
): Promise<string> {
  var client = await getClient();
  var base64Data = Buffer.from(fileBuffer).toString("base64");
  var lastError: unknown = null;

  for (var i = 0; i < MODELS.length; i++) {
    var model = MODELS[i];
    if (inCooldown(model)) continue;
    try {
      console.log("[GEMINI] trying " + model + " (" + (task || "generateFromDocument") + ")");
      await rateLimit(model);
      var response = await client.models.generateContent({
        model: model,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          prompt
        ],
        config: {
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      });
      trackCall(model, task);
      return response.text || "";
    } catch (err: unknown) {
      lastError = err;
      recordQuotaError(model, err);
      console.error("[GEMINI] " + model + " failed (" + (task || "generateFromDocument") + "):", err);
    }
  }
  console.error("[GEMINI] All models exhausted for generateFromDocument. Last error:", lastError);
  throw new Error("AI Vision service is temporarily unavailable. Please try again later.");
}

export var llm = {
  generate: generate,
  generateJson: generateJson,
  generateContent: generateContent,
  generateContentStream: generateContentStream,
  embedTexts: embedTexts,
  generateFromDocument: generateFromDocument
};

