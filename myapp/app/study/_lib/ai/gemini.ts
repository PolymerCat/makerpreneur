var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function getClient(): Promise<any> {
  var genai = await import("@google/genai");
  var client = new genai.GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
  return client;
}

var MODELS = [
  "gemini-2.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite"
];

var EMBED_MODELS = [
  "gemini-embedding-001",
  "text-embedding-004"
];

var MIN_GAP = 3.0;
var lastCallTime: Record<string, number> = {};

async function generate(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<string> {
  var client = await getClient();
  var lastError: unknown = null;
  for (var i = 0; i < MODELS.length; i++) {
    var model = MODELS[i];
    try {
      console.log("[GEMINI] trying " + model + " (" + (task || "generate") + ")");
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
      return response.text;
    } catch (err: unknown) {
      lastError = err;
      console.error("[GEMINI] " + model + " failed (" + (task || "generate") + "):", err);
    }
  }
  console.error("[GEMINI] All models exhausted for generate (" + (task || "generate") + "). Last error:", lastError);
  throw new Error("AI service is temporarily unavailable. Please try again later.");
}

async function generateJson(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<any> {
  var client = await getClient();
  var lastError: unknown = null;
  for (var i = 0; i < MODELS.length; i++) {
    var model = MODELS[i];
    try {
      console.log("[GEMINI] trying " + model + " (" + (task || "generateJson") + ")");
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
      var text = (response.text || "").trim();
      try {
        return JSON.parse(text);
      } catch (_e) {}
      if (text.startsWith("```")) {
        text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }
      return JSON.parse(text);
    } catch (err: unknown) {
      lastError = err;
      console.error("[GEMINI] " + model + " failed (" + (task || "generateJson") + "):", err);
    }
  }
  console.error("[GEMINI] All models exhausted for generateJson (" + (task || "generateJson") + "). Last error:", lastError);
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
      console.error("[GEMINI] " + model + " failed (" + (task || "generateFromDocument") + "):", err);
    }
  }
  console.error("[GEMINI] All models exhausted for generateFromDocument. Last error:", lastError);
  throw new Error("AI Vision service is temporarily unavailable. Please try again later.");
}

export var llm = {
  generate: generate,
  generateJson: generateJson,
  embedTexts: embedTexts,
  generateFromDocument: generateFromDocument
};
