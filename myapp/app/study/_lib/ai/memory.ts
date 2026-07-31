import { llm } from "./gemini";
import { sdb } from "../supabase-db";

export type ExtractedFact = {
  type: "fact" | "preference" | "goal" | "weakness";
  content: string;
  tags: string[];
  importance: number;
};

export type MemoryExtractResult = {
  summary: string;
  facts: ExtractedFact[];
};

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
      .slice(0, 5)
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
      "2. Extract any NEW durable facts about the student (skip small talk, greetings, or info already covered in existing memories).\n" +
      "   Valid types: 'fact', 'preference', 'goal', 'weakness'.\n" +
      "   Include relevant tags (e.g. ['5g', 'telecom']) and importance (0.1 to 1.0).\n\n" +
      "Return ONLY a JSON object formatted as:\n" +
      "{\n" +
      '  "summary": "updated conversation summary",\n' +
      '  "facts": [\n' +
      '    { "type": "weakness", "content": "Struggles with eigenvalues", "tags": ["math"], "importance": 0.8 }\n' +
      "  ]\n" +
      "}";

    var result: MemoryExtractResult = await llm.generateJson(
      prompt,
      0.2,
      1500,
      "memory_extract",
      "gemini-3.5-flash-lite"
    );

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

    // 3. Process new facts (dedup & embed)
    var toInsert: ExtractedFact[] = [];
    for (var i = 0; i < newFacts.length; i++) {
      var f = newFacts[i];
      if (!f.content || !f.type) continue;
      var cleanContent = f.content.trim().toLowerCase();
      var isDuplicate = existingMemories.some(function(em) {
        return em.content.trim().toLowerCase() === cleanContent;
      });
      if (!isDuplicate) {
        toInsert.push(f);
      }
    }

    if (toInsert.length > 0) {
      var contentsToEmbed = toInsert.map(function(f) { return f.content; });
      var embeddings = await llm.embedTexts(contentsToEmbed);

      for (var j = 0; j < toInsert.length; j++) {
        var fact = toInsert[j];
        var embStr = "[" + embeddings[j].join(",") + "]";
        await sdb.insert("memories", {
          userId: userId,
          courseId: courseId,
          conversationId: conversationId,
          type: fact.type,
          tags: fact.tags || [],
          content: fact.content,
          importance: fact.importance || 0.5,
          source: "chat",
          embedding: embStr
        });
      }
    }

    // 4. Cap memories at 200 rows per course to prevent bloat
    enforceMemoryCap(userId, courseId).catch(function(err) {
      console.error("[MEMORY] Cap enforcement error:", err);
    });

    return { summary: newSummary, facts: toInsert };
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
