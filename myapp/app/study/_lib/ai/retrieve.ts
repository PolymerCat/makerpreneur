import { llm } from "./gemini";
import { sdb } from "../supabase-db";

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
    var expandedRes = await llm.generateJson(expandPrompt, 0.3, 1000, "expand_queries");
    var expanded = expandedRes.value;
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
      var matPrefix = item.materialId ? item.materialId + ":" : "";
      var itemIdentifier =
        item.id !== undefined && item.id !== null && item.id !== ""
          ? item.id
          : (item.chunkIndex ?? "") + ":" + (item.text ?? "");
      var key = matPrefix + itemIdentifier;
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

export async function retrieveChunks(
  question: string,
  materialIds: string[],
  topK: number = 8
): Promise<any[]> {
  if (!materialIds || materialIds.length === 0) {
    return [];
  }
  var queryEmbedding = (await llm.embedTexts([question]))[0];
  var searches = materialIds.map(function(id) {
    return sdb.vectorSearch(id, queryEmbedding, 5);
  });
  var searchResults = await Promise.all(searches);
  return rrfFuse(searchResults, 60).slice(0, topK);
}

export { expandQueries, rrfFuse };

