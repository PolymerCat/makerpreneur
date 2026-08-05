import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runAgent } from "../../_lib/ai/agent";
import { logLlmCall } from "../../_lib/ai/logger";
import { downloadImageParts, GeminiImagePart } from "../../_lib/chat-images";
import { aiChat } from "../../actions";
import { retrieveChunks } from "../../_lib/ai/retrieve";
import { sdb, setServerClientGetter } from "../../_lib/supabase-db";

async function buildInjectedContext(
  userId: string,
  courseId: string
): Promise<string> {
  try {
    var supabase = await createServerSupabaseClient();
    var blocks: string[] = [];

    if (courseId) {
      var { data: subject } = await supabase
        .from("subjects")
        .select("name")
        .eq("id", courseId)
        .eq("created_by", userId)
        .single();
      if (subject?.name) {
        blocks.push("Active subject: " + subject.name);
      }

      var { data: plans } = await supabase
        .from("study_plans")
        .select("exam_date, goals")
        .eq("course_id", courseId)
        .order("exam_date", { ascending: false })
        .limit(1);
      if (plans && plans.length > 0) {
        var plan = plans[0];
        if (plan.exam_date) blocks.push("Exam date: " + plan.exam_date);
        if (plan.goals) blocks.push("Study goals: " + plan.goals);
      }
    }

    // Inject ALL memory types (fact, preference, goal, weakness) newest-first so
    // personal details reach the agent even when the client body param fails.
    var memories = await sdb.listMemories(userId, courseId || undefined);
    var memoryLines = memories
      .filter(function(m) { return String(m.type || "") !== "episode"; })
      .slice(0, 15)
      .map(function(m) { return "- [" + m.type + "] " + m.content; });
    if (memoryLines.length > 0) {
      blocks.push("Student memories:\n" + memoryLines.join("\n"));
    }

    return blocks.join("\n");
  } catch (err) {
    console.error("[CHAT-ROUTE] Context injection error:", err);
    return "";
  }
}

async function ragFallback(
  question: string,
  materialIds: string[],
  chatHistory: string,
  language: string
): Promise<string> {
  try {
    var chunks = await retrieveChunks(question, materialIds, 3);
    if (chunks.length === 0) {
      return "I couldn't find relevant material for that question. Could you rephrase it or select a different course material?";
    }
    return aiChat(chunks, question, chatHistory, language);
  } catch (err) {
    console.error("[CHAT-ROUTE] RAG fallback error:", err);
    return "I couldn't find relevant material for that question. Could you rephrase it or select a different course material?";
  }
}

export async function POST(request: Request) {
  setServerClientGetter(createServerSupabaseClient);
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const question = (body.question || "").trim();
    const materialIds: string[] = body.materialIds || [];
    const chatHistory = body.chatHistory || "";
    const language = body.language || "en";
    const summary = body.summary || "";
    const memories = body.memories || [];
    const courseId = body.courseId || body.subjectId || "";
    const images: string[] = body.images || [];

    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    let userId = "";
    let imageParts: GeminiImagePart[] = [];
    try {
      const supabase = await createServerSupabaseClient();
      const authRes = await supabase.auth.getUser();
      userId = authRes.data?.user?.id || "";

      if (images.length > 0) {
        imageParts = await downloadImageParts(supabase, images);
      }
    } catch (authErr) {
      console.error("[CHAT-ROUTE] Session/image setup error:", authErr);
    }

    const memoriesText = Array.isArray(memories)
      ? memories.join("\n")
      : String(memories || "");

    const injectedContext = await buildInjectedContext(userId, courseId);
    const summaryBlock = summary ? "Summary: " + summary : "";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        var totalTools = 0;
        try {
          const agentGen = runAgent({
            userId,
            question,
            subjectId: courseId,
            language,
            materialIds,
            injectedContext,
            chatHistory,
            memories: memoriesText,
            images: imageParts
          });

          for await (const event of agentGen) {
            if (event.type === "done") {
              totalTools = event.toolCount;
            }
            const sseLine = "data: " + JSON.stringify(event) + "\n\n";
            controller.enqueue(encoder.encode(sseLine));
          }
        } catch (agentErr) {
          console.error("[CHAT-ROUTE] Agent execution error, falling back to RAG:", agentErr);
          try {
            const answer = await ragFallback(question, materialIds, chatHistory, language);
            const textEvent = { type: "text", content: answer };
            controller.enqueue(encoder.encode("data: " + JSON.stringify(textEvent) + "\n\n"));
          } catch (ragErr) {
            console.error("[CHAT-ROUTE] RAG fallback error:", ragErr);
            const errEvent = { type: "text", content: "AI service is temporarily unavailable. Please try again later." };
            controller.enqueue(encoder.encode("data: " + JSON.stringify(errEvent) + "\n\n"));
          }
        }

        logLlmCall(
          {
            requestId,
            task: "agent_chat",
            model: "gemini-3.6-flash",
            latencyMs: Date.now() - startedAt,
            createdAt: new Date().toISOString()
          },
          userId
        );

        const doneEvent = { type: "done", toolCount: totalTools };
        controller.enqueue(encoder.encode("data: " + JSON.stringify(doneEvent) + "\n\n"));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive"
      }
    });
  } catch (err) {
    console.error("[CHAT-ROUTE] Fatal POST handler error:", err);
    return new Response(
      JSON.stringify({ error: "AI service is temporarily unavailable. Please try again later." }),
      {
        status: 500,
        headers: { "content-type": "application/json" }
      }
    );
  }
}
