import { llm, LlmUsage, SMALL_CHAT_SLOTS } from "./gemini";
import { buildGeminiTools, executeTool, ToolCtx } from "./tools";
import { GeminiImagePart } from "../chat-images";

export type AgentEvent =
  | { type: "tool_start"; tool: string }
  | { type: "tool_end"; tool: string; durationMs: number }
  | { type: "text"; content: string }
  | { type: "done"; toolCount: number };

export type RunAgentParams = {
  userId: string;
  question: string;
  subjectId: string;
  language: string;
  materialIds?: string[];
  injectedContext?: string;
  chatHistory?: string;
  memories?: string;
  images?: GeminiImagePart[];
};

export function buildAgentSystemPrompt(params: {
  injectedContext?: string;
  language?: string;
  chatHistory?: string;
  memories?: string;
}): string {
  const { injectedContext, language, chatHistory, memories } = params;

  let prompt = `You are Study Buddy, a personalized, intelligent study assistant for university students.

YOUR GOAL:
- Help the student understand course materials, prepare for exams, practice quizzes, flip flashcards, and organize study plans.
- Be supportive, concise, accurate, and structured in your explanations.

AVAILABLE TOOLS & RULES:
1. You have 11 powerful tools available (search_material, search_memory, list_memories, save_memory, generate_flashcards, generate_quiz, get_exam_readiness, get_study_plan, search_past_papers, translate_text, generate_exam_paper).
2. Call tools ONLY when necessary to answer the question or perform requested actions.
3. If the user asks for flashcards, quizzes, past papers, or PDF exam papers, execute the corresponding tool immediately.
4. IMPORTANT: When a tool (like generate_flashcards or generate_quiz) returns ok: true, the UI renders an interactive card widget from the link it provides. Do NOT list or write out the individual flashcard questions or quiz options in your chat message text. Simply provide a short 1-sentence friendly confirmation that includes the link (e.g. "Here's your quiz ready to go! /study/quizzes/<id>").
5. NEVER state or claim that a database or technical snag occurred when a tool returned ok: true.
6. When citing source materials from search_material, use bracketed numbers like [1], [2] to reference the relevant chunk text.
7. Keep your tone encouraging and academic.
8. If a tool returns an error, do NOT call tools again in this request - acknowledge it and answer from your knowledge or explain the limitation.
9. Memory handling: STUDENT MEMORIES above are the student's stored personal facts, listed newest-first. If they conflict, the first entry is the current truth. When the student asks about their own details (name, preferences, goals, weaknesses), answer ONLY from STUDENT MEMORIES or from the list_memories / search_memory tools - never invent or guess personal details. If STUDENT MEMORIES has no relevant entry for the asked detail, you MUST call list_memories before answering. If list_memories returns no relevant entry either, say so honestly (e.g. "I don't know your name yet - tell me and I'll remember it.") - NEVER guess, reuse, or invent a name or personal detail from chat history or anywhere else.
10. When the student states a personal fact about themselves (e.g. "call me X", "I prefer Y", "my goal is Z"), call save_memory to store it, then use the new value immediately in your reply.`;

  if (injectedContext) {
    prompt += `\n\nINJECTED COURSE CONTEXT:\n---\n${injectedContext}\n---`;
  }

  if (memories) {
    prompt += `\n\nSTUDENT MEMORIES:\n---\n${memories}\n---`;
  }

  if (chatHistory) {
    prompt += `\n\nRECENT CHAT HISTORY:\n---\n${chatHistory}\n---`;
  }

  if (language === "ms") {
    prompt += `\n\nLANGUAGE INSTRUCTION: Answer in Bahasa Melayu.`;
  } else {
    prompt += `\n\nLANGUAGE INSTRUCTION: Answer in English.`;
  }

  return prompt;
}

// Matches artifact URLs the UI can render: bare /study/... paths or PDF links.
var ARTIFACT_URL_RE = /((?:https?:\/\/[^\s()]+\.pdf)|(?:\/study\/(?:quizzes|flashcards)\/[0-9a-f-]{8,}))/i;

function extractArtifactUrl(toolResults: any[]): string | null {
  for (var i = 0; i < toolResults.length; i++) {
    var item = toolResults[i];
    if (!item.toolRes || item.toolRes.ok !== true) {
      continue;
    }
    var text = typeof item.toolRes.result === "string" ? item.toolRes.result : "";
    var m = text.match(ARTIFACT_URL_RE);
    if (m) {
      return m[1];
    }
  }
  return null;
}

export async function* runAgent(
  params: RunAgentParams
): AsyncGenerator<AgentEvent, void, unknown> {
  const {
    userId,
    question,
    subjectId,
    language,
    materialIds = [],
    injectedContext = "",
    chatHistory = "",
    memories = "",
    images = []
  } = params;

  console.log(`[AGENT-START] User ID: ${userId || "anon"} | Subject: ${subjectId || "none"} | Question: "${question.slice(0, 60)}..."`);

  // Route: classifier picks small fast models for simple chat, Gemini for
  // tool-needed requests (flashcards, quiz, PDF, memory, retrieval...).
  const route = await llm.classifyRoute(question);
  const isToolPath = route === "tool";
  console.log(`[AGENT-ROUTE] ${route.toUpperCase()}${isToolPath ? "" : " (small models)"}`);

  const ctx: ToolCtx = {
    userId,
    subjectId,
    language,
    materialIds
  };

  const tools = buildGeminiTools();
  const systemPrompt = buildAgentSystemPrompt({
    injectedContext,
    language,
    chatHistory,
    memories
  });

  const messages: any[] = [
    {
      role: "user",
      parts: [
        {
          text: `${systemPrompt}\n\nStudent Question:\n${question}`
        },
        ...images
      ]
    }
  ];

  let toolCount = 0;
  const MAX_TURNS = 4;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`[AGENT-TURN ${turn + 1}/${MAX_TURNS}] Querying LLM with ${messages.length} conversation parts...`);
    const stream = llm.generateContentStreamWithTools([...messages], {
      tools: isToolPath ? tools : [],
      temperature: 0.3,
      task: isToolPath ? "agent_probe" : "agent_chat",
      slots: isToolPath ? undefined : SMALL_CHAT_SLOTS
    });

    let calls: any[] = [];
    let lastUsage: LlmUsage | undefined;
    for await (const ev of stream) {
      if (ev.type === "text_delta" && ev.content) {
        yield { type: "text", content: ev.content };
      } else if (ev.type === "tool_calls") {
        calls = ev.calls;
        lastUsage = ev.usage;
      } else if (ev.type === "end") {
        lastUsage = ev.usage;
      }
    }

    if (lastUsage) {
      totalInputTokens += lastUsage.inputTokens || 0;
      totalOutputTokens += lastUsage.outputTokens || 0;
    }

    if (calls.length === 0) {
      console.log(`[AGENT-RESPONSE] Turn ${turn + 1}: No tool calls requested. Text streamed directly.`);
      yield { type: "done", toolCount };
      return;
    }

    console.log(`[AGENT-TOOL-CALLS] Turn ${turn + 1}: Model requested ${calls.length} tool call(s): ${calls.map((c: any) => c.name).join(", ")}`);

    // Echo ALL function calls returned in model turn
    messages.push({
      role: "model",
      parts: calls.map((c: any) => ({
        functionCall: {
          name: c.name,
          args: c.args || {}
        },
        thoughtSignature: c.thoughtSignature
      }))
    });

    // Execute all tool calls in parallel using Promise.all
    const toolResults = await Promise.all(
      calls.map(async (call: any) => {
        const toolName = call.name;
        const toolArgs = call.args || {};
        const started = Date.now();
        console.log(`[AGENT-EXEC-START] Executing tool "${toolName}" with args:`, toolArgs);
        const toolRes = await executeTool(toolName, toolArgs, ctx);
        const durationMs = Date.now() - started;
        console.log(`[AGENT-EXEC-DONE] Tool "${toolName}" finished in ${durationMs}ms. Status ok: ${toolRes?.ok}`);
        return { toolName, toolRes, durationMs };
      })
    );

    const functionResponseParts: any[] = [];

    for (const item of toolResults) {
      yield { type: "tool_start", tool: item.toolName };
      yield { type: "tool_end", tool: item.toolName, durationMs: item.durationMs };
      toolCount++;

      functionResponseParts.push({
        functionResponse: {
          name: item.toolName,
          response: item.toolRes
        }
      });
    }

    // Collect all tool functionResponse outputs into a single role: "user" message turn
    messages.push({
      role: "user",
      parts: functionResponseParts
    });

    var serviceDown = toolResults.some(function(item) {
      return item.toolRes && item.toolRes.ok === false && /AI service/i.test(item.toolRes.error || "");
    });
    if (serviceDown) {
      console.warn(`[AGENT-WARN] Tool execution reported AI service down. Halting turn execution.`);
      yield {
        type: "text",
        content: "The AI generation service is temporarily unavailable (likely a quota or outage issue), so I've stopped further tool calls. Please try again in a few minutes."
      };
      yield { type: "done", toolCount };
      return;
    }

    // Artifact tools (quiz, flashcards, exam paper) return a link in their result.
    // Stream a canned confirmation with it instead of burning another LLM probe turn.
    const artifactUrl = extractArtifactUrl(toolResults);
    if (artifactUrl) {
      const kind = artifactUrl.indexOf(".pdf") !== -1 ? "paper" : artifactUrl.indexOf("flashcards") !== -1 ? "flashcard" : "quiz";
      const labels = language === "ms"
        ? { quiz: "Kuiz anda sedia untuk digunakan!", flashcard: "Kad imbasan anda sedia!", paper: "Kertas peperiksaan anda sedia!" }
        : { quiz: "Here's your quiz ready to go!", flashcard: "Here are your flashcards ready to practice!", paper: "Here's your exam paper ready to download!" };
      console.log(`[AGENT-ARTIFACT] Canned confirmation for ${kind}: ${artifactUrl}`);
      yield { type: "text", content: `${labels[kind]} ${artifactUrl}` };
      yield { type: "done", toolCount };
      return;
    }
  }

  // Max turn limit reached fallback
  yield {
    type: "text",
    content: "I've completed maximum tool operations for this request. Let me know if you need further help!"
  };
  yield { type: "done", toolCount };
}
