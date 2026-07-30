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
  search_index: { materialId: "material_id", indexData: "index_data" },
  conversations: { userId: "user_id", createdAt: "created_at", updatedAt: "updated_at" },
  messages: { conversationId: "conversation_id", createdAt: "created_at" }
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
  listConversations: listConversations,
  createConversation: createConversation,
  deleteConversation: deleteConversation,
  listMessages: listMessages,
  addMessage: addMessage,
  renameConversation: renameConversation,
  uploadFile: uploadFile,
  getPublicUrl: getPublicUrl
};
