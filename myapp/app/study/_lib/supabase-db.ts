import { createBrowserClient } from "@supabase/ssr";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/* Helpers */
function pick(obj: any, keys: string[]): any {
  var result: any = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] !== undefined) {
      result[k] = obj[k];
    }
  }
  return result;
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

/* --- PUBLIC API (matches db.ts) --- */

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

async function seedDemoCourse(): Promise<void> {
  var client = getClient();
  var existing = await client.from("courses").select("id").limit(1);
  if (existing.data && existing.data.length > 0) {
    return;
  }
  await client.from("courses").insert({
    id: "demo_course",
    code: "DEMO101",
    name: "Demo Course",
    semester: "2026-1"
  });
}

async function seedDemoMaterials(): Promise<void> {
  var client = getClient();
  var existing = await client.from("materials").select("id").limit(1);
  if (existing.data && existing.data.length > 0) {
    return;
  }
  await seedDemoCourse();

  await client.from("materials").insert([
    {
      id: "demo_mat_1",
      course_id: "demo_course",
      title: "Introduction to Biology",
      file_url: "",
      file_type: "application/pdf",
      status: "ready",
      category: "regular",
      year: 2026,
      semester: "1"
    },
    {
      id: "demo_mat_2",
      course_id: "demo_course",
      title: "Cell Structure Notes",
      file_url: "",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "ready",
      category: "regular",
      year: 2026,
      semester: "1"
    }
  ]);

  await client.from("chunks").insert([
    {
      id: "demo_chunk_1",
      material_id: "demo_mat_1",
      page: 1,
      chunk_index: 0,
      text: "Biology is the natural science that studies life and living organisms. It encompasses the study of structure, function, growth, evolution, and distribution of all living things. Cells are the basic unit of life.",
      embedding: null
    },
    {
      id: "demo_chunk_2",
      material_id: "demo_mat_1",
      page: 1,
      chunk_index: 1,
      text: "There are two main types of cells: prokaryotic and eukaryotic. Prokaryotic cells lack a nucleus and membrane-bound organelles. Eukaryotic cells have a nucleus and various organelles including mitochondria and the endoplasmic reticulum.",
      embedding: null
    },
    {
      id: "demo_chunk_3",
      material_id: "demo_mat_1",
      page: 2,
      chunk_index: 0,
      text: "DNA is the hereditary material found in all living cells. It contains the genetic instructions for development, functioning, growth, and reproduction. The DNA molecule is shaped like a double helix.",
      embedding: null
    },
    {
      id: "demo_chunk_4",
      material_id: "demo_mat_2",
      page: 1,
      chunk_index: 0,
      text: "The cell membrane is a biological membrane that separates the interior of a cell from its external environment. It is selectively permeable and regulates what enters and leaves the cell.",
      embedding: null
    },
    {
      id: "demo_chunk_5",
      material_id: "demo_mat_2",
      page: 1,
      chunk_index: 1,
      text: "Mitochondria are known as the powerhouse of the cell. They generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy. Mitochondria have their own DNA.",
      embedding: null
    }
  ]);
}

/* semcache helpers */
async function semcacheGet(question: string, queryEmbedding: number[]): Promise<string | null> {
  var client = getClient();
  try {
    var embedding = "[" + queryEmbedding.join(",") + "]";
    var result = await client.rpc("search_semcache", {
      query_embedding: embedding,
      match_threshold: 0.95
    });
    if (result.data && result.data.length > 0) {
      return result.data[0].answer;
    }
  } catch (_err) {
  }
  return null;
}

async function semcachePut(question: string, answer: string, embedding: number[]): Promise<void> {
  var client = getClient();
  var embeddingStr = "[" + embedding.join(",") + "]";
  try {
    await client.from("semcache").insert({
      question: question,
      answer: answer,
      embedding: embeddingStr
    });
  } catch (_err) {
  }
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

async function downloadFile(bucket: string, path: string): Promise<Blob> {
  var client = getClient();
  var { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error("downloadFile: " + (error?.message || "no data returned"));
  }
  return data;
}

async function deleteFile(bucket: string, paths: string[]): Promise<void> {
  var client = getClient();
  var { error } = await client.storage.from(bucket).remove(paths);
  if (error) {
    throw new Error("deleteFile: " + error.message);
  }
}

function getPublicUrl(bucket: string, path: string): string {
  var client = getClient();
  var { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export var sdb = {
  insert: insert,
  getById: getById,
  listAll: listAll,
  update: update,
  delete: remove,
  vectorSearch: vectorSearch,
  materialText: materialText,
  countForCourse: countForCourse,
  seedDemoCourse: seedDemoCourse,
  seedDemoMaterials: seedDemoMaterials,
  semcacheGet: semcacheGet,
  semcachePut: semcachePut,
  listConversations: listConversations,
  createConversation: createConversation,
  deleteConversation: deleteConversation,
  listMessages: listMessages,
  addMessage: addMessage,
  renameConversation: renameConversation,
  uploadFile: uploadFile,
  downloadFile: downloadFile,
  deleteFile: deleteFile,
  getPublicUrl: getPublicUrl
};
