import { createBrowserClient } from "@supabase/ssr";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/* Column name mapping: camelCase (JS) -> snake_case (SQL) */
var COLUMN_MAP: Record<string, Record<string, string>> = {
  materials:    { courseId: "course_id", fileUrl: "file_url", fileType: "file_type", createdAt: "created_at" },
  chunks:       { materialId: "material_id", chunkIndex: "chunk_index" },
  decks:        { materialId: "material_id" },
  cards:        { deckId: "deck_id", dueDate: "due_date" },
  quizzes:      { materialId: "material_id" },
  questions:    { quizId: "quiz_id" },
  attempts:     { quizId: "quiz_id", gradedAt: "graded_at" },
  summaries:    { materialId: "material_id" },
  papers:       { courseId: "course_id", fileUrl: "file_url", extractedText: "extracted_text" },
  study_plans:  { courseId: "course_id", examDate: "exam_date" },
  plan_days:    { planId: "plan_id", dayNumber: "day_number" },
  schedule_blocks: { startsAt: "starts_at", endsAt: "ends_at" },
  predictions:  { courseId: "course_id", createdAt: "created_at", freqJson: "freq_json", questionsJson: "questions_json", studiedIds: "studied_ids" },
  generated_exams: { courseId: "course_id", courseCode: "course_code", fileUrl: "file_url", questionsJson: "questions_json", createdAt: "created_at" },
  search_index: { materialId: "material_id", indexData: "index_data" },
  conversations: { userId: "user_id", createdAt: "created_at", updatedAt: "updated_at" },
  messages: { conversationId: "conversation_id", createdAt: "created_at" },
  memories: { userId: "user_id", courseId: "course_id", conversationId: "conversation_id", createdAt: "created_at", updatedAt: "updated_at" }
};

function toSnake(table: string, data: any): any {
  var map = COLUMN_MAP[table];
  if (!map) {
    return data;
  }
  var result: any = {};
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var mapped = map[k] || k;
    result[mapped] = data[k];
  }
  return result;
}

function toCamel(table: string, row: any): any {
  if (!row) {
    return row;
  }
  var reverse: Record<string, string> = {};
  var map = COLUMN_MAP[table];
  if (map) {
    var mapKeys = Object.keys(map);
    for (var i = 0; i < mapKeys.length; i++) {
      reverse[map[mapKeys[i]]] = mapKeys[i];
    }
  }
  var result: any = {};
  var keys = Object.keys(row);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var mapped = reverse[k] || k;
    result[mapped] = row[k];
  }
  return result;
}

function toCamelList(table: string, rows: any[]): any[] {
  var result: any[] = [];
  for (var i = 0; i < rows.length; i++) {
    result.push(toCamel(table, rows[i]));
  }
  return result;
}

/* JSON fields that come back as objects but should be arrays */
var JSON_FIELDS: Record<string, string[]> = {
  questions: ["options"],
  plan_days: ["tasks"],
  attempts: ["answers"],
  predictions: ["freq_json", "questions_json", "studied_ids"]
};

function fixJsonFields(table: string, row: any): any {
  var fields = JSON_FIELDS[table];
  if (!fields) {
    return row;
  }
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (row[f] !== undefined && typeof row[f] === "string") {
      try {
        row[f] = JSON.parse(row[f]);
      } catch (_e) {
        row[f] = [];
      }
    }
  }
  return row;
}

/* --- PUBLIC API --- */

async function insert(table: string, data: any): Promise<any> {
  var client = getClient();
  var snake = toSnake(table, data);
  var result = await client.from(table).insert(snake).select().single();
  if (result.error) {
    throw new Error("insert " + table + ": " + result.error.message);
  }
  var row = toCamel(table, result.data);
  return fixJsonFields(table, row);
}

async function batchInsert(table: string, records: any[]): Promise<any[]> {
  if (records.length === 0) {
    return [];
  }
  var client = getClient();
  var snake = records.map(function(r) { return toSnake(table, r); });
  var result = await client.from(table).insert(snake).select();
  if (result.error) {
    throw new Error("batchInsert " + table + ": " + result.error.message);
  }
  return toCamelList(table, result.data || []).map(function(r) {
    return fixJsonFields(table, r);
  });
}

async function getById(table: string, rowId: string): Promise<any | null> {
  var client = getClient();
  var result = await client.from(table).select("*").eq("id", rowId).single();
  if (result.error) {
    if (result.error.code === "PGRST116") {
      return null;
    }
    throw new Error("getById " + table + ": " + result.error.message);
  }
  var row = toCamel(table, result.data);
  return fixJsonFields(table, row);
}

async function listAll(
  table: string,
  filters: Record<string, any> | null,
  orderBy: string | null
): Promise<any[]> {
  var client = getClient();
  var query = client.from(table).select("*");

  if (filters !== null) {
    var filterKeys = Object.keys(filters);
    for (var i = 0; i < filterKeys.length; i++) {
      var k = filterKeys[i];
      var mapped = k;
      var cmap = COLUMN_MAP[table];
      if (cmap && cmap[k]) {
        mapped = cmap[k];
      }
      query = query.eq(mapped, filters[k]);
    }
  }

  if (orderBy !== null) {
    var orderMapped = orderBy;
    var cmap2 = COLUMN_MAP[table];
    if (cmap2 && cmap2[orderBy]) {
      orderMapped = cmap2[orderBy];
    }
    query = query.order(orderMapped, { ascending: true });
  }

  var result = await query;
  if (result.error) {
    throw new Error("listAll " + table + ": " + result.error.message);
  }
  return toCamelList(table, result.data || []);
}

async function update(table: string, rowId: string, data: any): Promise<any | null> {
  var client = getClient();
  var snake = toSnake(table, data);
  var result = await client.from(table).update(snake).eq("id", rowId).select().single();
  if (result.error) {
    if (result.error.code === "PGRST116") {
      return null;
    }
    throw new Error("update " + table + ": " + result.error.message);
  }
  var row = toCamel(table, result.data);
  return fixJsonFields(table, row);
}

async function remove(table: string, rowId: string): Promise<boolean> {
  var client = getClient();
  var result = await client.from(table).delete().eq("id", rowId);
  if (result.error) {
    throw new Error("delete " + table + ": " + result.error.message);
  }
  return true;
}

async function vectorSearch(
  materialId: string,
  queryEmbedding: number[],
  limit: number
): Promise<any[]> {
  var client = getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.rpc("search_chunks", {
    query_embedding: embedding,
    match_material_id: materialId,
    match_count: limit
  });
  if (result.error) {
    console.error("vectorSearch error", result.error);
    return [];
  }
  return (result.data || []).map(function(r: any) {
    return {
      id: r.id,
      materialId: r.material_id,
      page: r.page,
      chunkIndex: r.chunk_index,
      text: r.text,
      similarity: r.similarity
    };
  });
}

async function materialText(materialIds: string[]): Promise<string> {
  var client = getClient();
  var result = "";
  for (var i = 0; i < materialIds.length; i++) {
    var mid = materialIds[i];
    var matResult = await client.from("materials").select("title").eq("id", mid).single();
    if (matResult.error) {
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

async function countForCourse(courseId: string): Promise<Record<string, number>> {
  var client = getClient();
  var matResult = await client.from("materials").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  var paperResult = await client.from("papers").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  var quizResult = await client.from("quizzes").select("id, materials!inner(course_id)", { count: "exact", head: true })
    .eq("materials.course_id", courseId);
  var deckResult = await client.from("decks").select("id, materials!inner(course_id)", { count: "exact", head: true })
    .eq("materials.course_id", courseId);

  return {
    matCount: matResult.count || 0,
    paperCount: paperResult.count || 0,
    quizCount: quizResult.count || 0,
    deckCount: deckResult.count || 0
  };
}

async function listGeneratedExams(courseId: string) {
  var client = getClient();
  var result = await client
    .from("generated_exams")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (result.error) {
    throw new Error("listGeneratedExams: " + result.error.message);
  }
  return toCamelList("generated_exams", result.data || []);
}

async function deleteGeneratedExam(id: string) {
  var client = getClient();
  var result = await client.from("generated_exams").delete().eq("id", id);
  if (result.error) {
    throw new Error("deleteGeneratedExam: " + result.error.message);
  }
  return true;
}

async function listConversations(userId: string) {
  var client = getClient();
  var result = await client
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (result.error) {
    throw new Error("listConversations: " + result.error.message);
  }
  return toCamelList("conversations", result.data || []);
}

async function createConversation(userId: string, title?: string) {
  var client = getClient();
  var now = new Date().toISOString();
  var result = await client.from("conversations").insert({
    user_id: userId,
    title: title || "New Chat",
    updated_at: now
  }).select("*").single();
  if (result.error) {
    throw new Error("createConversation: " + result.error.message);
  }
  return toCamel("conversations", result.data);
}

async function deleteConversation(id: string) {
  var client = getClient();
  var result = await client.from("conversations").delete().eq("id", id);
  if (result.error) {
    throw new Error("deleteConversation: " + result.error.message);
  }
}

async function listMessages(conversationId: string) {
  var client = getClient();
  var result = await client
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (result.error) {
    throw new Error("listMessages: " + result.error.message);
  }
  return toCamelList("messages", result.data || []);
}

async function addMessage(conversationId: string, role: string, content: string) {
  var client = getClient();
  var now = new Date().toISOString();
  var result = await client.from("messages").insert({
    conversation_id: conversationId,
    role: role,
    content: content,
    created_at: now
  });
  if (result.error) {
    throw new Error("addMessage: " + result.error.message);
  }
  var updateResult = await client
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversationId);
  if (updateResult.error) {
    console.error("addMessage bump updated_at:", updateResult.error.message);
  }
}

async function renameConversation(id: string, title: string) {
  var client = getClient();
  var result = await client
    .from("conversations")
    .update({ title: title })
    .eq("id", id);
  if (result.error) {
    throw new Error("renameConversation: " + result.error.message);
  }
}

/* --- Memory & Semcache Helpers --- */

async function listMemories(userId: string, courseId?: string) {
  var client = getClient();
  var query = client.from("memories").select("*").eq("user_id", userId);
  if (courseId) {
    query = query.or("course_id.eq." + courseId + ",course_id.is.null");
  }
  var result = await query.order("updated_at", { ascending: false });
  if (result.error) {
    console.error("listMemories error:", result.error);
    return [];
  }
  return toCamelList("memories", result.data || []);
}

async function memorySearch(
  userId: string,
  courseId: string | null,
  queryEmbedding: number[],
  limit: number = 8
) {
  var client = getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.rpc("search_memories", {
    query_embedding: embedding,
    match_user_id: userId,
    match_course_id: courseId,
    match_count: limit,
    match_threshold: 0.3
  });
  if (result.error) {
    console.error("memorySearch error:", result.error);
    return [];
  }
  return (result.data || []).map(function(r: any) {
    return {
      id: r.id,
      type: r.type,
      tags: r.tags,
      content: r.content,
      importance: r.importance,
      source: r.source,
      similarity: r.similarity
    };
  });
}

async function updateConversationSummary(conversationId: string, summary: string) {
  var client = getClient();
  var now = new Date().toISOString();
  var result = await client
    .from("conversations")
    .update({ summary: summary, updated_at: now })
    .eq("id", conversationId);
  if (result.error) {
    console.error("updateConversationSummary error:", result.error.message);
  }
}

async function cacheChatAnswer(question: string, queryEmbedding: number[], answer: string) {
  var client = getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.from("semcache").insert({
    question: question,
    answer: answer,
    embedding: embedding,
    kind: "chat"
  });
  if (result.error) {
    console.error("cacheChatAnswer error:", result.error.message);
  }
}

async function searchChatCache(queryEmbedding: number[], matchThreshold: number = 0.95) {
  var client = getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.rpc("search_semcache", {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_kind: "chat"
  });
  if (result.error) {
    console.error("searchChatCache error:", result.error);
    return null;
  }
  if (!result.data || result.data.length === 0) {
    return null;
  }
  return result.data[0];
}

async function searchSemcache(queryEmbedding: number[], matchThreshold: number = 0.95) {
  var client = getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.rpc("search_semcache", {
    query_embedding: embedding,
    match_threshold: matchThreshold
  });
  if (result.error) {
    console.error("searchSemcache error:", result.error);
    return null;
  }
  if (!result.data || result.data.length === 0) {
    return null;
  }
  return result.data[0];
}

async function cacheChunks(question: string, queryEmbedding: number[], chunks: string[]) {
  var client = getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.from("semcache").insert({
    question: question,
    answer: JSON.stringify(chunks),
    embedding: embedding
  });
  if (result.error) {
    console.error("cacheChunks error:", result.error.message);
  }
}

async function upsertEpisodeMemory(
  userId: string,
  courseId: string | null,
  conversationId: string,
  content: string,
  embedding: string
): Promise<void> {
  var client = getClient();
  var now = new Date().toISOString();
  var existing = await client
    .from("memories")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("type", "episode")
    .limit(1);

  if (existing.data && existing.data.length > 0) {
    var updateRes = await client
      .from("memories")
      .update({
        content: content,
        embedding: embedding,
        updated_at: now
      })
      .eq("id", existing.data[0].id);
    if (updateRes.error) {
      console.error("upsertEpisodeMemory update error:", updateRes.error.message);
    }
  } else {
    var insertRes = await client.from("memories").insert({
      user_id: userId,
      course_id: courseId,
      conversation_id: conversationId,
      type: "episode",
      tags: ["episode", "summary"],
      content: content,
      importance: 0.5,
      source: "chat",
      embedding: embedding
    });
    if (insertRes.error) {
      console.error("upsertEpisodeMemory insert error:", insertRes.error.message);
    }
  }
}

/* --- Storage helpers --- */

async function uploadFile(bucket: string, path: string, file: Blob | ArrayBuffer, contentType?: string): Promise<string> {
  var client = getClient();
  var { data, error } = await client.storage.from(bucket).upload(path, file, {
    contentType: contentType,
    upsert: true
  });
  if (error || !data) {
    throw new Error("uploadFile: " + (error?.message || "no data returned"));
  }
  return data.path;
}

function getPublicUrl(bucket: string, path: string): string {
  var client = getClient();
  var { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export var sdb = {
  insert: insert,
  batchInsert: batchInsert,
  getById: getById,
  listAll: listAll,
  update: update,
  delete: remove,
  vectorSearch: vectorSearch,
  materialText: materialText,
  countForCourse: countForCourse,
  listGeneratedExams: listGeneratedExams,
  deleteGeneratedExam: deleteGeneratedExam,
  listConversations: listConversations,
  createConversation: createConversation,
  deleteConversation: deleteConversation,
  listMessages: listMessages,
  addMessage: addMessage,
  renameConversation: renameConversation,
  listMemories: listMemories,
  memorySearch: memorySearch,
  upsertEpisodeMemory: upsertEpisodeMemory,
  updateConversationSummary: updateConversationSummary,
  cacheChatAnswer: cacheChatAnswer,
  searchChatCache: searchChatCache,
  searchSemcache: searchSemcache,
  cacheChunks: cacheChunks,
  uploadFile: uploadFile,
  getPublicUrl: getPublicUrl
};

