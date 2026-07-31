import { GoogleGenAI } from "@google/genai";
import { stripCitations } from "../../_lib/ai/citations";

var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// ponytail: Python-proven model list, sorted by free-tier RPD descending.
// Preferred chat model first, then highest-quota models, rest as fallback.
var MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash"
];

var LAST_CALL: Record<string, number> = {};
var MIN_GAP = 1.0;

var SYSTEM_PROMPT = "" +
  "You are Study Buddy, a personalized study assistant.\n" +
  "\n" +
  "YOUR JOB WITH CONTEXT:\n" +
  "- Source materials from the user's course are provided in the CONTEXT section below.\n" +
  "- Base your answer primarily on those materials.\n" +
  "- Do not fabricate information that isn't in the sources.\n" +
  "- If the sources only partially cover the question, answer what they cover then note what isn't covered.\n" +
  "\n" +
  "WHEN NO CONTEXT IS PROVIDED:\n" +
  "- Use your general knowledge to answer.\n" +
  "\n" +
  "EXAMPLES:\n" +
  "\n" +
  "CONTEXT:\n" +
  "---\n" +
  "[1] Quantum efficiency of a solar cell is the ratio of the number of charge carriers collected to the number of photons incident on the device. It is expressed as a percentage and varies with wavelength.\n" +
  "---\n" +
  "Student: What is quantum efficiency?\n" +
  "Assistant: According to your materials, quantum efficiency of a solar cell is the ratio of charge carriers collected to photons incident on the device, expressed as a percentage that varies with wavelength.\n" +
  "\n" +
  "CONTEXT:\n" +
  "---\n" +
  "[1] Quantum entanglement describes a state where two particles become correlated so that measuring one instantly determines the state of the other, regardless of distance.\n" +
  "---\n" +
  "Student: What are applications of quantum entanglement?\n" +
  "Assistant: Your materials define quantum entanglement as a state where two particles become correlated so that measuring one instantly determines the state of the other. They do not discuss specific applications, but from general knowledge: entanglement is used in quantum cryptography, quantum teleportation, and quantum computing.\n" +
  "\n" +
  "CONTEXT:\n" +
  "---\n" +
  "[NONE — no relevant source materials]\n" +
  "---\n" +
  "Student: How do I bake a cake?\n" +
  "Assistant: Your uploaded materials don't cover baking. From my general knowledge: to bake a cake, you typically need flour, sugar, eggs, butter, and baking powder. The basic steps are...\n" +
  "\n" +
  "GUIDELINES:\n" +
  "- Use clear markdown formatting (headings, bullets, code blocks when relevant).\n" +
  "- Keep answers concise but thorough — focus on what the student needs to learn.\n" +
  "- If you don't know, say so rather than guessing.\n" +
  "- Never include bracketed citation numbers like [1] or [7] in your answers.";

async function tryGenerateStream(
  client: GoogleGenAI,
  model: string,
  prompt: string
) {
  var now = Date.now();
  var last = LAST_CALL[model] || 0;
  var gap = (now - last) / 1000;
  if (gap < MIN_GAP) {
    var wait = Math.ceil((MIN_GAP - gap) * 1000);
    await new Promise(function(resolve) { setTimeout(resolve, wait); });
  }
  LAST_CALL[model] = Date.now();

  return client.models.generateContentStream({
    model: model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 2000
    }
  });
}

export async function POST(request: Request) {
  try {
    var body = await request.json();
    var question = body.question || "";
    var chunks = body.chunks || [];
    var chatHistory = body.chatHistory || "";
    var language = body.language || "en";
    var summary = body.summary || "";
    var memories = body.memories || []; // string[] or string
    var questionEmbedding = body.questionEmbedding || null; // number[] from aiRetrieve

    console.log("[CHAT-ROUTE] question:", question.slice(0, 50));
    console.log("[CHAT-ROUTE] chunks count:", chunks.length);

    if (question === "") {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // 1. Response Cache Check (semcache with kind='chat')
    var queryEmbedding: number[] | null = null;
    try {
      var dbMod = await import("../../_lib/supabase-db");
      if (Array.isArray(questionEmbedding) && questionEmbedding.length > 0) {
        queryEmbedding = questionEmbedding;
      } else {
        var llmMod = await import("../../_lib/ai/gemini");
        var embeddings = await llmMod.llm.embedTexts([question]);
        if (embeddings && embeddings.length > 0) {
          queryEmbedding = embeddings[0];
        }
      }
      var isShortHistory = !chatHistory || chatHistory.split("\n").length <= 4;
      if (queryEmbedding && isShortHistory) {
        var cachedHit = await dbMod.sdb.searchChatCache(queryEmbedding, 0.95);
        if (cachedHit && cachedHit.answer) {
          console.log("[CHAT-ROUTE] ⚡ Cache HIT for chat answer!");
          var encoderFast = new TextEncoder();
          var fastStream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoderFast.encode(cachedHit.answer));
              controller.close();
            }
          });
          return new Response(fastStream, {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "x-vercel-edge": "1"
            }
          });
        }
      }
    } catch (cacheErr) {
      console.log("[CHAT-ROUTE] Cache lookup skipped/failed:", cacheErr);
    }

    // 2. Build Memory & Context Blocks
    var memoryText = "";
    if (Array.isArray(memories) && memories.length > 0) {
      memoryText = "MEMORY (About this student):\n---\n" + memories.map(function(m: string) { return "- " + stripCitations(m); }).join("\n") + "\n---";
    } else if (typeof memories === "string" && memories.trim() !== "") {
      memoryText = "MEMORY (About this student):\n---\n" + stripCitations(memories) + "\n---";
    }

    var summaryText = "";
    if (summary !== "") {
      summaryText = "SUMMARY OF EARLIER CONVERSATION:\n---\n" + stripCitations(summary) + "\n---";
    }

    var contextText = "";
    if (chunks.length > 0) {
      contextText = "CONTEXT (from your uploaded materials):\n---\n";
      for (var i = 0; i < chunks.length; i++) {
        contextText = contextText + "[" + (i + 1) + "] " + stripCitations(chunks[i]) + "\n\n";
      }
      contextText = contextText + "---";
    }

    var langInstruction = "";
    if (language === "ms") {
      langInstruction = "Answer in Bahasa Melayu.";
    } else {
      langInstruction = "Answer in English.";
    }

    var historyText = "";
    if (chatHistory !== "") {
      historyText = "Recent Chat history:\n---\n" + stripCitations(chatHistory) + "\n---";
    }

    var promptParts = [];
    if (memoryText) promptParts.push(memoryText);
    if (summaryText) promptParts.push(summaryText);
    if (contextText) promptParts.push(contextText);
    if (historyText) promptParts.push(historyText);
    promptParts.push(langInstruction);
    promptParts.push("Student: " + question + "\nAssistant:");

    var prompt = promptParts.join("\n\n");

    var client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    var stream: AsyncGenerator<unknown> | null = null;
    var lastError: string = "";

    for (var m = 0; m < MODELS.length; m++) {
      var model = MODELS[m];
      try {
        console.log("[GEMINI] trying " + model + " for chat");
        stream = await tryGenerateStream(client, model, prompt);
        lastError = "";
        break;
      } catch (err: unknown) {
        var msg = String(err);
        lastError = msg;
        console.error("[GEMINI] " + model + " failed:", err);
      }
    }

    if (!stream) {
      console.error("[GEMINI] All models exhausted for chat. Last error:", lastError);
      throw new Error("AI service is temporarily unavailable. Please try again later.");
    }

    var encoder = new TextEncoder();
    var fullAnswerBuffer = "";
    var readable = new ReadableStream({
      async start(controller) {
        try {
          for await (var chunk of stream!) {
            var text = (chunk as { text?: string }).text || "";
            if (text !== "") {
              fullAnswerBuffer += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();

          // Save to cache after stream completes if embedding available
          if (queryEmbedding && fullAnswerBuffer.length > 20) {
            try {
              var dbMod = await import("../../_lib/supabase-db");
              await dbMod.sdb.cacheChatAnswer(question, queryEmbedding, fullAnswerBuffer);
              console.log("[CHAT-ROUTE] Saved answer to cache");
            } catch (_cErr) {}
          }
        } catch (err) {
          console.error("[GEMINI] stream error:", err);
          controller.enqueue(encoder.encode("\n\nAI service is temporarily unavailable. Please try again later."));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-vercel-edge": "1"
      }
    });
  } catch (err) {
    console.error("chat route error:", err);
    return new Response(JSON.stringify({ error: "AI service is temporarily unavailable. Please try again later." }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
