"use server";

import { llm } from "./_lib/ai/gemini";
import { prompts } from "./_lib/ai/prompts";
import { chunkPages } from "./_lib/ai/chunk";
import { extractPages } from "./_lib/ai/extract";
import { expandQueries, rrfFuse, rerank } from "./_lib/ai/retrieve";

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
  cardCount: number
): Promise<{ front: string; back: string }[]> {
  var count = cardCount || DEFAULT_CARD_COUNT;
  var prompt = prompts.flashcardsPrompt(fullText, language, count);
  return await llm.generateJson(prompt, 0.4, 4000, "flashcards");
}

export async function aiMakeQuiz(
  fullText: string,
  language: string,
  questionCount: number
): Promise<{ kind: string; prompt: string; options: string[] | null; answer: string; rubric: string | null; explanations?: Record<string, string> | null }[]> {
  var count = questionCount || DEFAULT_QUESTION_COUNT;
  var prompt = prompts.quizPrompt(fullText, language, count);
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
): Promise<string[]> {
  console.log("[aiRetrieve] START question:", question.slice(0, 60), "materialIds:", materialIds.length, "language:", language);

  var { createServerSupabaseClient } = await import("@/lib/supabase/server");
  var supabase = await createServerSupabaseClient();

  var queryEmbedding = await llm.embedTexts([question]);
  if (!queryEmbedding || queryEmbedding.length === 0) {
    console.log("[aiRetrieve] embedding returned empty, aborting");
    return [];
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
        return cached;
      }
    } catch (_e) {}
  }
  console.log("[aiRetrieve] semcache MISS");

  async function searchAll(text: string): Promise<any[]> {
    var emb = await llm.embedTexts([text]);
    if (!emb || emb.length === 0) {
      return [];
    }
    var embStr = "[" + emb[0].join(",") + "]";
    var searches = materialIds.map(function(id) {
      return supabase.rpc("search_chunks", {
        query_embedding: embStr,
        match_material_id: id,
        match_count: topK
      });
    });
    var results = await Promise.all(searches);
    var allResults: any[] = [];
    for (var i = 0; i < results.length; i++) {
      var data = results[i].data;
      if (data) {
        for (var j = 0; j < data.length; j++) {
          if (data[j].similarity >= MIN_SIMILARITY) {
            allResults.push(data[j]);
          }
        }
      }
    }
    return allResults;
  }

  var queries = await expandQueries(question, language);
  console.log("[aiRetrieve] expanded to", queries.length, "queries");

  var allLists: any[][] = [];
  for (var i = 0; i < queries.length; i++) {
    var qResults = await searchAll(queries[i]);
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

  return reranked;
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
