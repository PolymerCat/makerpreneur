import { llm } from "./gemini";
import { db } from "../db";

var BATCH_SIZE = 50;
var BATCH_DELAY_MS = 3000;

async function embedAndStore(
  materialId: string,
  courseId: string,
  chunks: { page: number; chunkIndex: number; text: string }[]
): Promise<void> {
  for (var i = 0; i < chunks.length; i = i + BATCH_SIZE) {
    var end = i + BATCH_SIZE;
    if (end > chunks.length) {
      end = chunks.length;
    }
    var batch = chunks.slice(i, end);
    var texts: string[] = [];
    for (var b = 0; b < batch.length; b++) {
      texts.push(batch[b].text);
    }
    var embeddings: number[][] = [];
    try {
      embeddings = await llm.embedTexts(texts);
    } catch (err) {
      console.error("Embedding batch failed for material " + materialId, err);
      await db.update("materials", materialId, { status: "failed" });
      return;
    }
    for (var b = 0; b < batch.length; b++) {
      await db.insert("chunks", {
        materialId: materialId,
        page: batch[b].page,
        chunkIndex: batch[b].chunkIndex,
        text: batch[b].text,
        embedding: embeddings[b] || []
      });
    }
    if (end < chunks.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  await db.update("materials", materialId, { status: "ready" });
}

function sleep(ms: number): Promise<void> {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

export { embedAndStore };
