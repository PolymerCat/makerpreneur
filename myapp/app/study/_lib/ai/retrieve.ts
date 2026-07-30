import { llm } from "./gemini";
import { db } from "../db";

var DEFAULT_TOP_K = 8;

async function retrieve(
  question: string,
  materialId: string,
  topK: number | null
): Promise<{ text: string; similarity: number }[]> {
  var k = topK || DEFAULT_TOP_K;
  var queryEmbedding: number[][] = [];
  try {
    queryEmbedding = await llm.embedTexts([question]);
  } catch (err) {
    console.error("Embedding failed for query", err);
    return [];
  }
  var results = await db.vectorSearch(materialId, queryEmbedding[0], k);
  return results.map(function(r: any) {
    return { text: r.text, similarity: r.similarity };
  });
}

async function retrieveAdvanced(
  question: string,
  materialId: string,
  topK: number | null,
  language: string
): Promise<{ text: string; similarity: number }[]> {
  var k = topK || DEFAULT_TOP_K;
  var queries = await expandQueries(question, language);
  var allResults: any[][] = [];
  for (var i = 0; i < queries.length; i++) {
    var qEmbedding: number[][] = [];
    try {
      qEmbedding = await llm.embedTexts([queries[i]]);
    } catch (err) {
      continue;
    }
    var results = await db.vectorSearch(materialId, qEmbedding[0], k * 2);
    allResults.push(results);
  }
  var fused = rrfFuse(allResults, 60);
  fused = fused.slice(0, k);
  var topTexts: string[] = [];
  for (var i = 0; i < fused.length; i++) {
    topTexts.push(fused[i].text);
  }
  var reranked = await rerank(question, topTexts, k);
  return reranked.map(function(text: string) {
    return { text: text, similarity: 1.0 };
  });
}

async function expandQueries(
  question: string,
  language: string
): Promise<string[]> {
  var langInstruction = "";
  if (language === "ms") {
    langInstruction = "Generate diverse paraphrases in Bahasa Melayu.";
  } else {
    langInstruction = "Generate diverse paraphrases in English.";
  }
  var expandPrompt = "Given the question below, generate 3 diverse paraphrases.\n" +
    langInstruction + "\n" +
    "Return a JSON array of strings.\n\nQUESTION: " + question;
  var result: string[] = [question];
  try {
    var expanded = await llm.generateJson(expandPrompt, 0.3, 1000, "expand_queries");
    if (Array.isArray(expanded)) {
      for (var i = 0; i < expanded.length; i++) {
        if (typeof expanded[i] === "string") {
          result.push(expanded[i]);
        }
      }
    }
  } catch (err) {
  }
  return result;
}

function rrfFuse(resultLists: any[][], k: number): any[] {
  var scoreMap: Record<string, { item: any; score: number }> = {};
  for (var listIdx = 0; listIdx < resultLists.length; listIdx++) {
    var list = resultLists[listIdx];
    for (var rank = 0; rank < list.length; rank++) {
      var item = list[rank];
      var key = item.text;
      if (scoreMap[key]) {
        scoreMap[key].score = scoreMap[key].score + 1 / (k + rank + 1);
      } else {
        scoreMap[key] = { item: item, score: 1 / (k + rank + 1) };
      }
    }
  }
  var entries = Object.keys(scoreMap).map(function(key: string) {
    return scoreMap[key];
  });
  entries.sort(function(a: any, b: any) {
    return b.score - a.score;
  });
  return entries.map(function(e: any) {
    return e.item;
  });
}

async function rerank(
  question: string,
  chunkTexts: string[],
  topK: number
): Promise<string[]> {
  var listText = "";
  for (var i = 0; i < chunkTexts.length; i++) {
    var truncated = chunkTexts[i].substring(0, 800);
    listText = listText + "--- CHUNK " + i + " ---\n" + truncated + "\n\n";
  }
  var rerankPrompt = "Given the question, rank these chunks by relevance.\n" +
    "QUESTION: " + question + "\n\n" + listText +
    "Return a JSON array of chunk indices sorted from most relevant to least relevant (e.g. [3, 0, 1, 2]).\n" +
    "Only return indices for chunks that are relevant.";
  try {
    var result = await llm.generateJson(rerankPrompt, 0.2, 2000, "rerank");
    var indices: number[] = [];
    if (Array.isArray(result)) {
      for (var i = 0; i < result.length; i++) {
        var idx = parseInt(result[i], 10);
        if (!isNaN(idx) && idx >= 0 && idx < chunkTexts.length) {
          indices.push(idx);
        }
      }
    }
    var sortedChunks: string[] = [];
    for (var i = 0; i < indices.length; i++) {
      sortedChunks.push(chunkTexts[indices[i]]);
    }
    for (var i = 0; i < chunkTexts.length; i++) {
      if (sortedChunks.indexOf(chunkTexts[i]) === -1) {
        sortedChunks.push(chunkTexts[i]);
      }
    }
    return sortedChunks.slice(0, topK);
  } catch (err) {
    return chunkTexts.slice(0, topK);
  }
}

export { retrieve, retrieveAdvanced };
