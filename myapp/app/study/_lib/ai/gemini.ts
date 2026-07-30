var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function getClient(): Promise<any> {
  var genai = await import("@google/genai");
  var client = new genai.GoogleGenAI({
    apiKey: GEMINI_API_KEY
  });
  return client;
}

var DEFAULT_MODEL = "gemini-2.0-flash";
var EMBED_MODEL = "gemini-embedding-001";
var MIN_GAP = 3.0;
var lastCallTime: Record<string, number> = {};

async function generate(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<string> {
  var client = await getClient();
  var model = DEFAULT_MODEL;
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
}

async function generateJson(
  prompt: string,
  temperature: number,
  maxTokens: number,
  task: string | null
): Promise<any> {
  var client = await getClient();
  var model = DEFAULT_MODEL;
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
  var text = response.text;
  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }
  text = text.replace(/\\(?!["\\\/bfnrt])/g, "");
  return JSON.parse(text);
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  var client = await getClient();
  var response = await client.models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    config: {
      outputDimensionality: 768
    }
  });
  return response.embeddings.map(function(e: any) {
    return e.values;
  });
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

export var llm = {
  generate: generate,
  generateJson: generateJson,
  embedTexts: embedTexts
};
