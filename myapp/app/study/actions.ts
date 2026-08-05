"use server";

import { llm } from "./_lib/ai/gemini";
import { prompts } from "./_lib/ai/prompts";
import { chunkPages } from "./_lib/ai/chunk";
import { extractPages } from "./_lib/ai/extract";
import { generatePdfFromExamJson } from "./_lib/ai/exam-pdf";
import { looksGlobal } from "./_lib/ai/memory-merge";
var DEFAULT_CARD_COUNT = 10;
var DEFAULT_QUESTION_COUNT = 10;

export async function aiSummarize(
  fullText: string,
  mode: string,
  language: string
): Promise<string> {
  var prompt = prompts.summarizePrompt(fullText, mode, language);
  return (await llm.generate(prompt, 0.2, 2000, "summarize")).value;
}

export async function aiMakeFlashcards(
  fullText: string,
  language: string,
  cardCount: number,
  memoryText: string = ""
): Promise<{ front: string; back: string }[]> {
  var startTime = Date.now();
  var count = cardCount || DEFAULT_CARD_COUNT;
  console.log("[ACTION] [aiMakeFlashcards] Generating " + count + " cards for topic/text: \"" + fullText.slice(0, 60) + "...\"");

  var prompt = prompts.flashcardsPrompt(fullText, language, count);
  if (memoryText) {
    prompt = "MEMORY (what we know about this student):\n---\n" + memoryText + "\n---\n\n" + prompt;
  }

  var res = (await llm.generateJson(prompt, 0.4, 4000, "flashcards")).value;
  var cards: any[] = [];
  if (Array.isArray(res)) {
    cards = res;
  } else if (res && Array.isArray(res.flashcards)) {
    cards = res.flashcards;
  } else if (res && Array.isArray(res.cards)) {
    cards = res.cards;
  } else if (res && typeof res === "object") {
    var keys = Object.keys(res);
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(res[keys[i]])) {
        cards = res[keys[i]];
        break;
      }
    }
  }

  console.log("[ACTION] [aiMakeFlashcards] Successfully generated " + cards.length + " card(s) in " + (Date.now() - startTime) + "ms");
  return cards;
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
  var result = (await llm.generateJson(prompt, 0.4, 16000, "quiz")).value;
  return result.questions;
}

export async function aiGradeEssay(
  question: string,
  rubric: string,
  studentAnswer: string
): Promise<{ score: number; feedback: string }> {
  var prompt = prompts.essayGradePrompt(question, rubric, studentAnswer);
  return (await llm.generateJson(prompt, 0.1, 1000, "essay_grade")).value;
}

export async function aiPredictQuestions(
  styleData: string,
  courseName: string,
  language: string
): Promise<{ question: string; modelAnswer: string; marks: number; probability: string; topic: string }[]> {
  var prompt = prompts.predictorPrompt(styleData, courseName, language);
  return (await llm.generateJson(prompt, 0.5, 4000, "predict")).value;
}

export async function aiNameTopics(
  questions: string[],
  courseName: string
): Promise<string[]> {
  if (questions.length === 0) {
    return [];
  }
  var prompt = prompts.topicNamePrompt(questions, courseName);
  var res = (await llm.generateJson(prompt, 0.2, 2000, "topic_names")).value;
  var names = Array.isArray(res) ? res : (res && res.names) || [];
  return names.map(function(n: any) { return String(n); });
}

export async function aiExtractPastQuestions(
  topicNames: string[],
  courseName: string,
  papersText: string
): Promise<Record<string, string[]>> {
  if (topicNames.length === 0 || !papersText || papersText.trim().length === 0) {
    return {};
  }
  var prompt = prompts.pastQuestionsPrompt(topicNames, courseName, papersText);
  var res = (await llm.generateJson(prompt, 0.1, 6000, "past_questions")).value;
  var topics = Array.isArray(res) ? res : (res && res.topics) || [];
  var result: Record<string, string[]> = {};
  for (var i = 0; i < topics.length; i++) {
    var name = String(topics[i].name || "").trim();
    if (name && Array.isArray(topics[i].questions)) {
      result[name] = topics[i].questions.map(function(q: any) { return String(q); });
    }
  }
  return result;
}

export async function aiMakeStudyPath(
  courseName: string,
  examDate: string,
  goals: string,
  language: string
): Promise<{ days: { dayNumber: number; date: string; topic: string; tasks: string[] }[] }> {
  var prompt = prompts.studyPathPrompt(courseName, examDate, goals, language);
  return (await llm.generateJson(prompt, 0.4, 4000, "study_path")).value;
}

export async function aiChat(
  chunks: string[],
  question: string,
  chatHistory: string,
  language: string
): Promise<string> {
  var prompt = prompts.chatPrompt(chunks, question, chatHistory, language);
  return (await llm.generate(prompt, 0.3, 2000, "chat")).value;
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
  var result = (await llm.generateJson(prompt, 0.1, 4000, "translate")).value;
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

    var { setServerClientGetter } = await import("./_lib/supabase-db");
    setServerClientGetter(() => getSupabaseServerClient());

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

    var { setServerClientGetter } = await import("./_lib/supabase-db");
    setServerClientGetter(() => getSupabaseServerClient());

    var memMod = await import("./_lib/ai/memory");
    await memMod.saveMemoryFact(userId, {
      courseId: looksGlobal(type, content) ? null : courseId,
      type: type,
      content: content,
      tags: tags || [],
      importance: 0.8,
      source: "manual"
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

    var { setServerClientGetter } = await import("./_lib/supabase-db");
    setServerClientGetter(() => getSupabaseServerClient());

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
  var jsonStr = (await llm.generate(prompt, 0.2, 8000, "generateExamJson")).value;
  
  // Gemini might return markdown block. Clean it.
  var cleanJsonStr = jsonStr.replace(/^```json/i, "").replace(/```$/i, "").trim();
  var jsonObj = JSON.parse(cleanJsonStr);
  
  var pdfBuffer = await generatePdfFromExamJson(jsonObj);
  
  var examId = crypto.randomUUID();
  var storagePath = courseId + "/generated_exams/" + examId + ".pdf";
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
    throw new Error("Storage Upload Error (" + uploadError.message + ").");
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
