"use server";

import { llm } from "./_lib/ai/gemini";
import { prompts } from "./_lib/ai/prompts";
import { chunkPages } from "./_lib/ai/chunk";
import { extractPages } from "./_lib/ai/extract";
import { expandQueries, rrfFuse, rerank } from "./_lib/ai/retrieve";
import { generatePdfFromExamJson } from "./_lib/ai/exam-pdf";
var DEFAULT_CARD_COUNT = 10;
var DEFAULT_QUESTION_COUNT = 10;

export async function aiSummarize(
  fullText: string,
  mode: string,
  language: string
): Promise<string> {
  var prompt = prompts.summarizePrompt(fullText, mode, language);
  return await llm.generate(prompt, 0.2, 2000, "summarize");
}

export async function aiMakeFlashcards(
  fullText: string,
  language: string,
  cardCount: number,
  memoryText: string = ""
): Promise<{ front: string; back: string }[]> {
  var count = cardCount || DEFAULT_CARD_COUNT;
  var prompt = prompts.flashcardsPrompt(fullText, language, count);
  if (memoryText) {
    prompt = "MEMORY (what we know about this student):\n---\n" + memoryText + "\n---\n\n" + prompt;
  }
  return await llm.generateJson(prompt, 0.4, 4000, "flashcards");
}

export async function aiMakeQuiz(
  fullText: string,
  language: string,
  questionCount: number,
  memoryText: string = ""
): Promise<{ kind: string; prompt: string; options: string[] | null; answer: string; rubric: string | null; explanations?: Record<string, string> | null }[]> {
  var count = questionCount || DEFAULT_QUESTION_COUNT;
  var prompt = prompts.quizPrompt(fullText, language, count);
  if (memoryText) {
    prompt = "MEMORY (what we know about this student):\n---\n" + memoryText + "\n---\n\n" + prompt;
  }
  var result = await llm.generateJson(prompt, 0.4, 16000, "quiz");
  return result.questions;
}

export async function aiGradeEssay(
  question: string,
  rubric: string,
  studentAnswer: string
): Promise<{ score: number; feedback: string }> {
  var prompt = prompts.essayGradePrompt(question, rubric, studentAnswer);
  return await llm.generateJson(prompt, 0.1, 1000, "essay_grade");
}

export async function aiPredictQuestions(
  styleData: string,
  courseName: string,
  language: string
): Promise<{ question: string; modelAnswer: string; marks: number; probability: string }[]> {
  var prompt = prompts.predictorPrompt(styleData, courseName, language);
  return await llm.generateJson(prompt, 0.5, 4000, "predict");
}

export async function aiMakeStudyPath(
  courseName: string,
  examDate: string,
  goals: string,
  language: string
): Promise<{ days: { dayNumber: number; date: string; topic: string; tasks: string[] }[] }> {
  var prompt = prompts.studyPathPrompt(courseName, examDate, goals, language);
  return await llm.generateJson(prompt, 0.4, 4000, "study_path");
}

export async function aiChat(
  chunks: string[],
  question: string,
  chatHistory: string,
  language: string
): Promise<string> {
  var prompt = prompts.chatPrompt(chunks, question, chatHistory, language);
  return await llm.generate(prompt, 0.3, 2000, "chat");
}

export async function aiEmbedQuery(question: string): Promise<number[]> {
  var result = await llm.embedTexts([question]);
  return result[0];
}

export async function aiEmbedTexts(texts: string[]): Promise<number[][]> {
  return await llm.embedTexts(texts);
}

export async function deleteStorageFiles(paths: string[]): Promise<void> {
  var { createServerSupabaseClient } = await import("@/lib/supabase/server");
  var supabase = await createServerSupabaseClient();
  var { error } = await supabase.storage.from("materials").remove(paths);
  if (error) {
    throw new Error("deleteStorageFiles: " + error.message);
  }
}

var MIN_SIMILARITY = 0.2;
var RRF_K = 60;

export async function aiRetrieve(
  question: string,
  materialIds: string[],
  topK: number,
  language: string = "en"
): Promise<{ chunks: string[]; embedding: number[] }> {
  console.log("[aiRetrieve] START question:", question.slice(0, 60), "materialIds:", materialIds.length, "language:", language);

  var { createServerSupabaseClient } = await import("@/lib/supabase/server");
  var supabase = await createServerSupabaseClient();

  var queryEmbedding = await llm.embedTexts([question]);
  if (!queryEmbedding || queryEmbedding.length === 0) {
    console.log("[aiRetrieve] embedding returned empty, aborting");
    return { chunks: [], embedding: [] };
  }
  var embedding = queryEmbedding[0];
  var embeddingStr = "[" + embedding.join(",") + "]";

  var cacheResult = await supabase.rpc("search_semcache", {
    query_embedding: embeddingStr,
    match_threshold: 0.95
  });
  if (cacheResult.data && cacheResult.data.length > 0) {
    console.log("[aiRetrieve] semcache HIT, question:", cacheResult.data[0].question);
    try {
      var cached = JSON.parse(cacheResult.data[0].answer);
      if (Array.isArray(cached) && cached.length > 0) {
        console.log("[aiRetrieve] returning cached chunks:", cached.length);
        return { chunks: cached, embedding: embedding };
      }
    } catch (_e) {}
  }
  console.log("[aiRetrieve] semcache MISS");

  async function searchWith(emb: number[]): Promise<any[]> {
    var embStr = "[" + emb.join(",") + "]";
    var searches = materialIds.map(function(id) {
      return supabase.rpc("search_chunks", {
        query_embedding: embStr,
        match_material_id: id,
        match_count: topK
      });
    });
    var results = await Promise.all(searches);
    var qResults: any[] = [];
    for (var r = 0; r < results.length; r++) {
      var data = results[r].data;
      if (data) {
        for (var j = 0; j < data.length; j++) {
          if (data[j].similarity >= MIN_SIMILARITY) {
            qResults.push(data[j]);
          }
        }
      }
    }
    return qResults;
  }

  var words = question.trim().split(/\s+/).length;
  var isSimple = words < 15;
  if (isSimple) {
    console.log("[aiRetrieve] FAST PATH (simple question,", words, "words)");
    var direct = await searchWith(embedding);
    direct.sort(function(a: any, b: any) { return b.similarity - a.similarity; });
    var fastChunks = direct.slice(0, topK * 2).map(function(r: any) { return r.text; });
    console.log("[aiRetrieve] fast path returned", fastChunks.length, "chunks");
    if (fastChunks.length > 0) {
      try {
        await supabase.from("semcache").insert({
          question: question,
          answer: JSON.stringify(fastChunks),
          embedding: embeddingStr
        });
      } catch (_e) {}
    }
    return { chunks: fastChunks, embedding: embedding };
  }

  var queries = await expandQueries(question, language);
  console.log("[aiRetrieve] expanded to", queries.length, "queries");

  var queryEmbs = await llm.embedTexts(queries);
  var allLists: any[][] = [];
  for (var i = 0; i < queries.length; i++) {
    var emb = queryEmbs && queryEmbs[i] ? queryEmbs[i] : null;
    if (!emb || emb.length === 0) {
      allLists.push([]);
      continue;
    }
    var qResults = await searchWith(emb);
    console.log("[aiRetrieve] query", i, "returned", qResults.length, "chunks");
    allLists.push(qResults);
  }

  var fused = rrfFuse(allLists, RRF_K);
  console.log("[aiRetrieve] fused", fused.length, "chunks");

  var topTexts: string[] = [];
  var fuseK = topK * 3;
  for (var i = 0; i < fused.length && i < fuseK; i++) {
    topTexts.push(fused[i].text);
  }
  console.log("[aiRetrieve] sending", topTexts.length, "chunks to reranker");

  var reranked = await rerank(question, topTexts, topK * 2);
  console.log("[aiRetrieve] reranker returned", reranked.length, "chunks");

  if (reranked.length > 0) {
    try {
      await supabase.from("semcache").insert({
        question: question,
        answer: JSON.stringify(reranked),
        embedding: embeddingStr
      });
      console.log("[aiRetrieve] cached result");
    } catch (_e) {
      console.log("[aiRetrieve] cache insert failed (ignored)");
    }
  }

  return { chunks: reranked, embedding: embedding };
}

export async function aiDetectMetadata(
  firstPageText: string,
  fileName: string
): Promise<{ title: string; year: number; semester: string; category: string; courseCode: string }> {
  var genai = await import("./_lib/ai/detect");
  return await genai.detectMetadata(firstPageText, fileName);
}

export async function aiExtractAndChunk(
  fileText: string,
  fileType: string,
  fileName: string
): Promise<{ page: number; chunkIndex: number; text: string }[]> {
  var pages = extractPages(fileText, fileType, fileName);
  var chunks = chunkPages(pages);
  return chunks;
}

export async function aiTranslate(
  fullText: string,
  targetLanguage: string
): Promise<string> {
  var prompt = prompts.translatePrompt(fullText, targetLanguage);
  var result = await llm.generateJson(prompt, 0.1, 4000, "translate");
  return result.translatedText || "";
}

export async function aiExtractMemory(
  conversationId: string,
  courseId: string | null,
  lastUserMsg: string,
  lastReply: string
): Promise<void> {
  try {
    var supabase = await getSupabaseServerClient();
    var authRes = await supabase.auth.getUser();
    var userId = authRes.data?.user?.id;
    if (!userId) return;

    var dbMod = await import("./_lib/supabase-db");
    var sdb = dbMod.sdb;

    var convRes = await supabase.from("conversations").select("summary").eq("id", conversationId).single();
    var currentSummary = convRes.data?.summary || "";

    var existingMemories = await sdb.listMemories(userId, courseId || undefined);

    var memMod = await import("./_lib/ai/memory");
    await memMod.extractMemory(
      userId,
      conversationId,
      courseId,
      lastUserMsg,
      lastReply,
      currentSummary,
      existingMemories
    );
  } catch (err) {
    console.error("[ACTIONS] aiExtractMemory error:", err);
  }
}

export async function aiSaveMemory(
  courseId: string | null,
  type: string,
  content: string,
  tags: string[]
): Promise<boolean> {
  try {
    var supabase = await getSupabaseServerClient();
    var authRes = await supabase.auth.getUser();
    var userId = authRes.data?.user?.id;
    if (!userId) return false;

    var embeddings = await llm.embedTexts([content]);
    var embStr = "[" + embeddings[0].join(",") + "]";

    var dbMod = await import("./_lib/supabase-db");
    await dbMod.sdb.insert("memories", {
      userId: userId,
      courseId: courseId,
      type: type,
      tags: tags || [],
      content: content,
      importance: 0.8,
      source: "manual",
      embedding: embStr
    });
    return true;
  } catch (err) {
    console.error("[ACTIONS] aiSaveMemory error:", err);
    return false;
  }
}

export async function aiDeleteMemory(id: string): Promise<boolean> {
  try {
    var dbMod = await import("./_lib/supabase-db");
    return await dbMod.sdb.delete("memories", id);
  } catch (err) {
    console.error("[ACTIONS] aiDeleteMemory error:", err);
    return false;
  }
}

export async function aiRecordQuizResult(
  courseId: string | null,
  quizTitle: string,
  weakTopics: string[],
  score: number
): Promise<void> {
  try {
    var supabase = await getSupabaseServerClient();
    var authRes = await supabase.auth.getUser();
    var userId = authRes.data?.user?.id;
    if (!userId) return;

    var dbMod = await import("./_lib/supabase-db");
    var existingMemories = await dbMod.sdb.listMemories(userId, courseId || undefined);

    for (var i = 0; i < weakTopics.length; i++) {
      var topic = weakTopics[i];
      var text = "Struggled with topic: " + topic + " (scored " + score + "% in quiz '" + quizTitle + "')";
      var isDup = existingMemories.some(function(m: any) {
        return m.content.toLowerCase() === text.toLowerCase();
      });
      if (!isDup) {
        var embeddings = await llm.embedTexts([text]);
        var embStr = "[" + embeddings[0].join(",") + "]";
        await dbMod.sdb.insert("memories", {
          userId: userId,
          courseId: courseId,
          type: "weakness",
          tags: ["quiz", "weakness"],
          content: text,
          importance: 0.8,
          source: "quiz",
          embedding: embStr
        });
      }
    }
  } catch (err) {
    console.error("[ACTIONS] aiRecordQuizResult error:", err);
  }
}

async function getSupabaseServerClient() {
  var ssr = await import("@supabase/ssr");
  var headers = await import("next/headers");
  var cookieStore = await headers.cookies();
  return ssr.createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        }
      }
    }
  );
}

async function serverMaterialText(materialIds: string[]): Promise<string> {
  var client = await getSupabaseServerClient();
  var result = "";
  for (var i = 0; i < materialIds.length; i++) {
    var mid = materialIds[i];
    var matResult = await client.from("materials").select("title").eq("id", mid).single();
    if (matResult.error || !matResult.data) {
      continue;
    }
    var title = matResult.data.title;
    result = result + "=== " + title + " ===\n\n";
    var chunksResult = await client.from("chunks")
      .select("text, page, chunk_index")
      .eq("material_id", mid)
      .order("page", { ascending: true })
      .order("chunk_index", { ascending: true });
    if (chunksResult.data) {
      for (var ci = 0; ci < chunksResult.data.length; ci++) {
        result = result + chunksResult.data[ci].text + "\n\n";
      }
    }
  }
  return result.trim();
}

async function serverListMaterials(courseId: string): Promise<any[]> {
  var client = await getSupabaseServerClient();
  var { data } = await client.from("materials")
    .select("*")
    .eq("status", "ready")
    .eq("course_id", courseId)
    .order("title", { ascending: true });
  return (data || []).map(function(r: any) {
    return {
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      category: r.category,
      status: r.status
    };
  });
}

export async function aiGeneratePdfExam(
  courseId: string,
  selectedPaperIds: string[],
  courseCode?: string,
  title?: string,
  numQuestions: number = 4
) {
  var dbMod = await import("./_lib/db");
  var finalCourseCode = (courseCode && courseCode.trim()) ? courseCode.trim() : "CST434";
  var finalTitle = (title && title.trim()) ? title.trim() : "Final Examination";

  var allMats = await serverListMaterials(courseId);
  
  var syllabusIds = allMats
    .filter(function(m: any) {
      return m.category !== "exam_paper" && selectedPaperIds.indexOf(m.id) === -1;
    })
    .map(function(m: any) { return m.id; });
  
  var syllabusText = "";
  if (syllabusIds.length > 0) {
    syllabusText = await serverMaterialText(syllabusIds);
  }
  
  var pastPapersText = "";
  if (selectedPaperIds.length > 0) {
    pastPapersText = await serverMaterialText(selectedPaperIds);
  }
  
  console.log("[aiGeneratePdfExam] syllabusText length:", syllabusText.length, "pastPapersText length:", pastPapersText.length);
  if (!syllabusText.trim() && !pastPapersText.trim()) {
    throw new Error("No reference content found for exam generation. Please ensure you have uploaded and selected valid course materials.");
  }
  
  var prompt = prompts.generateExamPaperJsonPrompt(syllabusText, pastPapersText, finalCourseCode, finalTitle, numQuestions);
  var jsonStr = await llm.generate(prompt, 0.2, 8000, "generateExamJson");
  
  // Gemini might return markdown block. Clean it.
  var cleanJsonStr = jsonStr.replace(/^```json/i, "").replace(/```$/i, "").trim();
  var jsonObj = JSON.parse(cleanJsonStr);
  
  var pdfBuffer = await generatePdfFromExamJson(jsonObj);
  
  var examId = crypto.randomUUID();
  var storagePath = "generated_exams/" + examId + ".pdf";
  var bucket = "materials";
  
  var { createServerSupabaseClient } = await import("@/lib/supabase/server");
  var serverClient = await createServerSupabaseClient();
  var { error: uploadError } = await serverClient.storage
    .from(bucket)
    .upload(storagePath, pdfBuffer as any, {
      contentType: "application/pdf",
      upsert: true
    });
  if (uploadError) {
    throw new Error("Storage Upload Error (" + uploadError.message + "). If RLS error persists, run app/study/_sql/0008_storage_rls.sql in Supabase SQL Editor.");
  }
  var fileUrl = dbMod.db.getPublicUrl(bucket, storagePath);
  
  var record = await dbMod.db.insert("generated_exams", {
    courseId: courseId,
    title: finalTitle,
    courseCode: finalCourseCode,
    fileUrl: fileUrl,
    questionsJson: JSON.stringify(jsonObj)
  });
  
  return record;
}
