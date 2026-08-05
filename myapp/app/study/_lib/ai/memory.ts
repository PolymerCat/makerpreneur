import { llm } from "./gemini";
import { sdb } from "../supabase-db";
import { decideMemoryMerge } from "./memory-merge";

export type ExtractedFact = {
  type: "fact" | "preference" | "goal" | "weakness";
  content: string;
  tags: string[];
  importance: number;
  global?: boolean;
};

export type MemoryExtractResult = {
  summary: string;
  facts: ExtractedFact[];
};

export type SaveMemoryFactOptions = {
  courseId: string | null;
  conversationId?: string | null;
  type: string;
  content: string;
  tags?: string[];
  importance?: number;
  source?: string;
};

export async function saveMemoryFact(
  userId: string,
  opts: SaveMemoryFactOptions
): Promise<{ action: "insert" | "replace"; id: string | null }> {
  var embeddings = await llm.embedTexts([opts.content]);
  var embStr = "[" + embeddings[0].join(",") + "]";

  // Global search (no course filter) so a fact saved in any subject can
  // replace an older conflicting version saved elsewhere.
  var matches = await sdb.memorySearch(userId, null, embeddings[0], 8, 0.45);
  var best = null;
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].id && matches[i].type !== "episode") {
      best = matches[i];
      break;
    }
  }

  var decision = decideMemoryMerge(
    opts.type,
    opts.content,
    best
      ? { type: best.type, content: best.content, similarity: best.similarity }
      : null
  );

  if (decision.action === "replace" && best) {
    await sdb.update("memories", best.id, {
      courseId: opts.courseId,
      conversationId: opts.conversationId || null,
      type: opts.type,
      tags: opts.tags || [],
      content: opts.content,
      importance: opts.importance ?? 0.5,
      source: opts.source || "chat",
      embedding: embStr,
      updatedAt: new Date().toISOString()
    });
    return { action: "replace", id: best.id };
  }

  var row = await sdb.insert("memories", {
    userId: userId,
    courseId: opts.courseId,
    conversationId: opts.conversationId || null,
    type: opts.type,
    tags: opts.tags || [],
    content: opts.content,
    importance: opts.importance ?? 0.5,
    source: opts.source || "chat",
    embedding: embStr
  });
  return { action: "insert", id: row.id };
}

export async function extractMemory(
  userId: string,
  conversationId: string,
  courseId: string | null,
  lastUserMsg: string,
  lastReply: string,
  currentSummary: string,
  existingMemories: { id: string; type: string; content: string }[]
): Promise<MemoryExtractResult> {
  try {
    var existingText = existingMemories
      .slice(0, 50)
      .map(function(m) { return "[" + m.type + "] " + m.content; })
      .join("\n");

    var prompt = "" +
      "You are an AI memory manager for a student study assistant.\n" +
      "Analyze the latest exchange in the conversation alongside existing summary and stored memories.\n\n" +
      "CURRENT SUMMARY OF CONVERSATION:\n" +
      (currentSummary || "(None)") + "\n\n" +
      "EXISTING MEMORIES (Do NOT extract duplicate info):\n" +
      (existingText || "(None)") + "\n\n" +
      "LATEST EXCHANGE:\n" +
      "Student: " + lastUserMsg + "\n" +
      "Assistant: " + lastReply + "\n\n" +
      "INSTRUCTIONS:\n" +
      "1. Update the rolling summary of the conversation (concise, key topics covered, max 150 words).\n" +
      "2. Extract ONLY durable facts explicitly stated BY THE STUDENT about themselves.\n" +
      "   - NEVER extract information from the Assistant's reply; the assistant can be wrong.\n" +
      "   - Skip if the student only asked a question, greeted, or made small talk.\n" +
      "   - If the student states a new value for something already stored (e.g. a new name or a changed preference), extract the NEW value so it replaces the old one.\n" +
      "   - Valid types: 'fact', 'preference', 'goal', 'weakness'.\n" +
      "   - 'global': true if the fact applies regardless of subject (name, language, personal background, general preferences); false if subject-specific (e.g. a weakness in a topic, a goal for this exam).\n" +
      "   - Include relevant tags (e.g. ['5g', 'telecom']) and importance (0.1 to 1.0).\n\n" +
      "Return ONLY a JSON object formatted as:\n" +
      "{\n" +
      '  "summary": "updated conversation summary",\n' +
      '  "facts": [\n' +
      '    { "type": "preference", "content": "Student prefers to be called bobo", "tags": ["name"], "importance": 0.9, "global": true }\n' +
      "  ]\n" +
      "}";

    var resObj = await llm.generateJson(
      prompt,
      0.2,
      1500,
      "memory_extract",
      "gemini-3.5-flash-lite"
    );
    var result: MemoryExtractResult = resObj.value;

    var newSummary = result.summary || currentSummary;
    var newFacts = result.facts || [];

    // 1. Update conversation summary if changed
    if (newSummary && newSummary !== currentSummary) {
      try {
        var { createServerSupabaseClient } = await import("@/lib/supabase/server");
        var serverClient = await createServerSupabaseClient();
        await serverClient
          .from("conversations")
          .update({ summary: newSummary, updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch (sumErr) {
        console.error("[MEMORY] updateConversationSummary error:", sumErr);
        await sdb.updateConversationSummary(conversationId, newSummary);
      }
    }

    // 2. Upsert episode memory row for this conversation
    if (newSummary) {
      try {
        var { createServerSupabaseClient } = await import("@/lib/supabase/server");
        var serverClient = await createServerSupabaseClient();
        var epEmbedding = await llm.embedTexts([newSummary]);
        var epEmbStr = "[" + epEmbedding[0].join(",") + "]";
        var now = new Date().toISOString();
        var existing = await serverClient
          .from("memories")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("type", "episode")
          .limit(1);
        if (existing.data && existing.data.length > 0) {
          await serverClient
            .from("memories")
            .update({ content: newSummary, embedding: epEmbStr, updated_at: now })
            .eq("id", existing.data[0].id);
        } else {
          await serverClient.from("memories").insert({
            user_id: userId,
            course_id: courseId,
            conversation_id: conversationId,
            type: "episode",
            tags: ["episode", "summary"],
            content: newSummary,
            importance: 0.5,
            source: "chat",
            embedding: epEmbStr
          });
        }
      } catch (epErr) {
        console.error("[MEMORY] Episode upsert notice:", epErr);
      }
    }

    // 3. Save new facts (dedup exact copies; semantic upserts replace older
    // conflicting versions of the same fact instead of piling up duplicates)
    var saved: ExtractedFact[] = [];
    for (var i = 0; i < newFacts.length; i++) {
      var f = newFacts[i];
      if (!f.content || !f.type) continue;
      var cleanContent = f.content.trim().toLowerCase();
      var isDuplicate = existingMemories.some(function(em) {
        return em.content.trim().toLowerCase() === cleanContent;
      });
      if (isDuplicate) continue;
      await saveMemoryFact(userId, {
        courseId: f.global ? null : courseId,
        conversationId: conversationId,
        type: f.type,
        content: f.content.trim(),
        tags: f.tags || [],
        importance: f.importance || 0.5,
        source: "chat"
      });
      saved.push(f);
    }

    // 4. Cap memories at 200 rows per course to prevent bloat
    enforceMemoryCap(userId, courseId).catch(function(err) {
      console.error("[MEMORY] Cap enforcement error:", err);
    });

    return { summary: newSummary, facts: saved };
  } catch (err) {
    console.error("[MEMORY] extractMemory error (swallowed to protect chat):", err);
    return { summary: currentSummary, facts: [] };
  }
}

async function enforceMemoryCap(userId: string, courseId: string | null): Promise<void> {
  var memories = await sdb.listMemories(userId, courseId || undefined);
  if (memories.length > 200) {
    // Sort by importance ascending, then createdAt ascending
    var sorted = memories.filter(function(m: any) { return m.type !== "episode"; }).sort(function(a: any, b: any) {
      if (a.importance !== b.importance) return a.importance - b.importance;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    var toDeleteCount = memories.length - 200;
    for (var i = 0; i < toDeleteCount && i < sorted.length; i++) {
      await sdb.delete("memories", sorted[i].id);
    }
  }
}
