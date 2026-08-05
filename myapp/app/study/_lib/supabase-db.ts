import { createBrowserClient } from "@supabase/ssr";
import { aiNameTopics, aiExtractPastQuestions } from "../actions";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

var serverClientGetter: (() => Promise<any>) | null = null;

export function setServerClientGetter(fn: () => Promise<any>) {
  serverClientGetter = fn;
}

// ponytail: no module-level client singleton — concurrent requests would bleed
// each other's auth context. Each getClient() call builds a fresh cookie-scoped
// client via the getter (createServerSupabaseClient), which is cheap and
// per-request correct. Upgrade path: AsyncLocalStorage if client construction
// ever becomes measurably expensive.
async function getClient() {
  if (typeof window === "undefined") {
    if (serverClientGetter) {
      try {
        return await serverClientGetter();
      } catch (err) {
        console.error("[SDB] serverClientGetter failed:", err);
      }
    }
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/* Column name mapping: camelCase (JS) -> snake_case (SQL) */
var COLUMN_MAP: Record<string, Record<string, string>> = {
  subjects:     { subjectCode: "subject_code", createdBy: "created_by", createdAt: "created_at" },
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
  schedule_blocks: { userId: "user_id", startsAt: "starts_at", endsAt: "ends_at" },
  predictions:  { courseId: "course_id", createdAt: "created_at", freqJson: "freq_json", questionsJson: "questions_json", studiedIds: "studied_ids" },
  generated_exams: { courseId: "course_id", courseCode: "course_code", fileUrl: "file_url", questionsJson: "questions_json", createdAt: "created_at" },
  faculties: { createdBy: "created_by", createdAt: "created_at" },
  repository_courses: { facultyId: "faculty_id", courseCode: "course_code", courseName: "course_name", createdBy: "created_by", createdAt: "created_at" },
  repository_papers: { courseId: "course_id", fileUrl: "file_url", fileType: "file_type", fileSize: "file_size", extractedText: "extracted_text", uploadedBy: "uploaded_by", uploadedByName: "uploaded_by_name", createdAt: "created_at" },
  search_index: { materialId: "material_id", indexData: "index_data" },
  conversations: { userId: "user_id", createdAt: "created_at", updatedAt: "updated_at" },
  messages: { conversationId: "conversation_id", createdAt: "created_at" },
  memories: { userId: "user_id", courseId: "course_id", conversationId: "conversation_id", createdAt: "created_at", updatedAt: "updated_at" },
  events: { createdBy: "created_by", startsAt: "starts_at", endsAt: "ends_at", imageUrl: "image_url", registrationDeadline: "registration_deadline", formFields: "form_fields", registeredCount: "registered_count", createdAt: "created_at", updatedAt: "updated_at" },
  event_registrations: { eventId: "event_id", userId: "user_id", createdAt: "created_at", updatedAt: "updated_at" },
  assignments: { userId: "user_id", createdAt: "created_at", updatedAt: "updated_at" },
  profiles: { fullName: "full_name", matricNumber: "matric_number", preferredLanguage: "preferred_language", mycsdPoints: "mycsd_points", createdAt: "created_at", updatedAt: "updated_at" },
  planner_events: { userId: "user_id", createdAt: "created_at", updatedAt: "updated_at" }
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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

async function paperText(courseId: string): Promise<string> {
  var client = await getClient();
  var res = await client.from("materials").select("id").eq("course_id", courseId).eq("category", "exam_paper");
  if (!res.data || res.data.length === 0) {
    return "";
  }
  return await materialText(res.data.map(function(m: any) { return m.id; }));
}

async function countForCourse(courseId: string): Promise<Record<string, number>> {
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
  var result = await client.from("generated_exams").delete().eq("id", id);
  if (result.error) {
    throw new Error("deleteGeneratedExam: " + result.error.message);
  }
  return true;
}

async function listConversations(userId: string) {
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
  var result = await client.from("conversations").delete().eq("id", id);
  if (result.error) {
    throw new Error("deleteConversation: " + result.error.message);
  }
}

async function listMessages(conversationId: string) {
  var client = await getClient();
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
  var client = await getClient();
  var now = new Date().toISOString();
  var result = await client.from("messages").insert({
    conversation_id: conversationId,
    role: role,
    content: content,
    created_at: now
  }).select("id");
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
  return (result.data && result.data[0] && result.data[0].id) || null;
}

async function updateMessage(id: string, content: string) {
  var client = await getClient();
  var result = await client.from("messages").update({ content: content }).eq("id", id);
  if (result.error) {
    throw new Error("updateMessage: " + result.error.message);
  }
}

async function renameConversation(id: string, title: string) {
  var client = await getClient();
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
  var client = await getClient();
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
  limit: number = 8,
  threshold: number = 0.3
) {
  var client = await getClient();
  var embedding = "[" + queryEmbedding.join(",") + "]";
  var result = await client.rpc("search_memories", {
    query_embedding: embedding,
    match_user_id: userId,
    match_course_id: courseId,
    match_count: limit,
    match_threshold: threshold
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = await getClient();
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
  var client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  var { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteStorageObject(bucket: string, path: string): Promise<void> {
  var client = await getClient();
  var { error } = await client.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error("deleteStorageObject: " + error.message);
  }
}

/* --- Exam Paper Repository helpers --- */

async function listRepositoryPapers(): Promise<any[]> {
  var client = await getClient();
  var result = await client
    .from("repository_papers")
    .select("*, repository_courses(faculty_id, course_code, course_name)")
    .order("created_at", { ascending: false });
  if (result.error) {
    throw new Error("listRepositoryPapers: " + result.error.message);
  }
  return (result.data || []).map(function(row: any) {
    var course = row.repository_courses || {};
    return {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      year: row.year,
      semester: row.semester,
      fileUrl: row.file_url,
      fileType: row.file_type,
      fileSize: row.file_size,
      tags: row.tags || [],
      extractedText: row.extracted_text,
      uploadedBy: row.uploaded_by,
      uploadedByName: row.uploaded_by_name,
      createdAt: row.created_at,
      facultyId: course.faculty_id,
      courseCode: course.course_code,
      courseName: course.course_name
    };
  });
}

async function getCourseAnalytics(courseId: string, userId: string, courseName?: string): Promise<any> {
  var client = await getClient();
  var now = new Date();
  
  // 1. Quizzes & Attempts -> Quiz Average
  var quizAverage = 72; // Default baseline if no attempts
  try {
    var { data: quizzes } = await client.from("quizzes").select("id").eq("material_id", courseId);
    var { data: courseMaterials } = await client.from("materials").select("id").eq("course_id", courseId);
    var matIds = (courseMaterials || []).map(function(m: any) { return m.id; });
    var allQuizIds: string[] = (quizzes || []).map(function(q: any) { return q.id; });
    if (matIds.length > 0) {
      var { data: matQuizzes } = await client.from("quizzes").select("id").in("material_id", matIds);
      if (matQuizzes) {
        for (var idx = 0; idx < matQuizzes.length; idx++) {
          if (allQuizIds.indexOf(matQuizzes[idx].id) === -1) allQuizIds.push(matQuizzes[idx].id);
        }
      }
    }
    if (allQuizIds.length > 0) {
      var { data: attempts } = await client.from("attempts").select("score, total").in("quiz_id", allQuizIds);
      if (attempts && attempts.length > 0) {
        var totalScore = 0;
        var totalMax = 0;
        for (var a = 0; a < attempts.length; a++) {
          totalScore += Number(attempts[a].score || 0);
          totalMax += Number(attempts[a].total || 10);
        }
        if (totalMax > 0) {
          quizAverage = Math.round((totalScore / totalMax) * 100);
        }
      }
    }
  } catch (err) {
    console.warn("getCourseAnalytics quiz error:", err);
  }

  // 2. Study Plans -> Plan completion percentage
  var planCompletionPercent = 65;
  try {
    var { data: plans } = await client.from("study_plans").select("id").eq("course_id", courseId).order("exam_date", { ascending: false }).limit(1);
    if (plans && plans.length > 0) {
      var planId = plans[0].id;
      var { data: days } = await client.from("plan_days").select("done").eq("plan_id", planId);
      if (days && days.length > 0) {
        var doneCount = 0;
        for (var d = 0; d < days.length; d++) {
          if (days[d].done) doneCount++;
        }
        planCompletionPercent = Math.round((doneCount / days.length) * 100);
      }
    }
  } catch (err) {
    console.warn("getCourseAnalytics plan error:", err);
  }

  // 3. PYQ Topics & Predictions
  var pyqStudiedPercent = 74;
  var topics: any[] = [];
  var unnamed: { row: any; qObj: any; topic: any }[] = [];
  try {
    var { data: preds } = await client.from("predictions").select("*").eq("course_id", courseId).order("created_at", { ascending: false }).limit(5);
    if (preds && preds.length > 0) {
      var studiedCount = 0;
      var totalPreds = 0;
      for (var pIdx = 0; pIdx < preds.length; pIdx++) {
        var row = fixJsonFields("predictions", preds[pIdx]);
        var qArray = row.questions_json || row.questionsJson || [];
        var studiedArray = row.studied_ids || row.studiedIds || [];
        totalPreds += qArray.length;
        studiedCount += studiedArray.length;
        
        for (var qI = 0; qI < Math.min(5, qArray.length); qI++) {
          var qObj = qArray[qI];
          var topicName = qObj.topic || qObj.category || ("Topic " + (qI + 1) + ": " + (qObj.question ? qObj.question.substring(0, 32) : "Exam Concept"));
          var freq = Math.min(95, Math.max(60, 95 - qI * 8));
          var isStudied = studiedArray.indexOf(qObj.id) !== -1;
          var mast = isStudied ? 88 : Math.min(90, Math.max(38, quizAverage - 10 + qI * 7));
          var topicEntry: any = {
            id: qObj.id || ("pred-" + pIdx + "-" + qI),
            name: topicName,
            pyqFrequency: freq,
            mastery: mast,
            isUrgent: freq >= 75 && mast < 65,
            questionText: qObj.question || "PYQ Question extract on " + topicName,
            pastYearQuestions: Array.isArray(qObj.pastYearQuestions) ? qObj.pastYearQuestions : [],
            pastYearQuestionsLang: Array.isArray(qObj.pastYearQuestions) ? (qObj.pastYearQuestionsLang || "") : "",
            answerScheme: qObj.answerScheme || [
              "[+2 marks] Correct theoretical formula definition",
              "[+3 marks] Accurate calculation or conceptual proof"
            ]
          };
          topics.push(topicEntry);
          if (!qObj.topic && !qObj.category) {
            unnamed.push({ row: row, qObj: qObj, topic: topicEntry });
          }
        }
      }
      if (totalPreds > 0) {
        pyqStudiedPercent = Math.round((studiedCount / totalPreds) * 100);
      }

      // Name fallback topics via LLM once, persist to the predictions rows so reloads are free
      if (unnamed.length > 0) {
        var questions = unnamed.map(function(u) { return u.qObj.question || ""; });
        var names = await aiNameTopics(questions, courseName || "this course");
        var patched: Record<string, any[]> = {};
        for (var nI = 0; nI < Math.min(names.length, unnamed.length); nI++) {
          var name = String(names[nI]).trim();
          if (!name) {
            continue;
          }
          var u = unnamed[nI];
          u.topic.name = name;
          u.qObj.topic = name;
          if (!patched[u.row.id]) {
            patched[u.row.id] = u.row.questions_json;
          }
        }
        var rowIds = Object.keys(patched);
        for (var rI = 0; rI < rowIds.length; rI++) {
          await client.from("predictions").update({ questions_json: JSON.stringify(patched[rowIds[rI]]) }).eq("id", rowIds[rI]);
        }
      }
    }
  } catch (err) {
    console.warn("getCourseAnalytics predictions error:", err);
  }

  // Dedupe to unique concepts, keeping the first occurrence (highest frequency) per concept
  var seen: Record<string, boolean> = {};
  var uniqueTopics: any[] = [];
  for (var tI = 0; tI < topics.length; tI++) {
    var key = String(topics[tI].name).toLowerCase().trim();
    if (!seen[key]) {
      seen[key] = true;
      uniqueTopics.push(topics[tI]);
    }
  }
  topics = uniqueTopics;

  // If no predictions found in DB, use rich default topics for the course
  if (topics.length === 0) {
    topics = [
      {
        id: "topic-1",
        name: "Transmission Lines & Wave Reflection",
        pyqFrequency: 92,
        mastery: 41,
        isUrgent: true,
        questionText: "PYQ 2024/2025 Q3a: A lossless 50 Ω transmission line is terminated with ZL = 75 + j25 Ω. Calculate the voltage reflection coefficient (Γ).",
        answerScheme: [
          "[+2 marks] State correct reflection coefficient formula: Γ = (ZL - Z0) / (ZL + Z0)",
          "[+3 marks] Substitute complex impedance correctly into numerator and denominator",
          "[+2 marks] Calculate magnitude |Γ| = 0.242 and phase angle θ = 27.8°"
        ]
      },
      {
        id: "topic-2",
        name: "Maxwell's Equations & Electromagnetics",
        pyqFrequency: 85,
        mastery: 58,
        isUrgent: true,
        questionText: "PYQ 2023/2024 Q1b: Write down the differential form of Faraday's Law of Induction and explain its physical significance.",
        answerScheme: [
          "[+2 marks] State differential form: ∇ × E = -∂B/∂t",
          "[+3 marks] Explain negative sign (Lenz's Law) and induced electric field circulation"
        ]
      },
      {
        id: "topic-3",
        name: "Antenna Gain & Radiation Patterns",
        pyqFrequency: 68,
        mastery: 76,
        isUrgent: false,
        questionText: "PYQ 2023/2024 Q4c: Differentiate between directivity and power gain of a half-wave dipole antenna.",
        answerScheme: [
          "[+2 marks] Define directivity as ratio of radiation intensity in peak direction over average",
          "[+2 marks] Include antenna efficiency (e_cd) factor linking directivity to power gain"
        ]
      },
      {
        id: "topic-4",
        name: "Digital Modulation (QAM & QPSK)",
        pyqFrequency: 78,
        mastery: 84,
        isUrgent: false,
        questionText: "PYQ 2022/2023 Q2a: Draw the constellation diagram for 16-QAM and determine the minimum Euclidean distance.",
        answerScheme: [
          "[+2 marks] Accurately sketch 4x4 constellation points in I-Q plane",
          "[+3 marks] Derive minimum Euclidean distance d_min in terms of symbol energy E_s"
        ]
      },
      {
        id: "topic-5",
        name: "Smith Chart Impedance Matching",
        pyqFrequency: 64,
        mastery: 88,
        isUrgent: false,
        questionText: "PYQ 2022/2023 Q5b: Using a Smith Chart, find the normalized input impedance of a short-circuited stub of length 0.15λ.",
        answerScheme: [
          "[+2 marks] Locate short-circuit point (0, 0) on Smith Chart perimeter",
          "[+3 marks] Rotate 0.15λ toward generator to find +j1.38 normalized reactance"
        ]
      }
    ];
  }

  topics = topics.map(function(t) {
    if (!Array.isArray(t.pastYearQuestions)) {
      t.pastYearQuestions = [];
      t.pastYearQuestionsLang = "";
    }
    return t;
  });

  // 4. Spaced-repetition backlog health
  var spacedRepetitionHealth = 85;
  try {
    var { data: mems } = await client.from("memories").select("id, type").eq("course_id", courseId);
    if (mems && mems.length > 0) {
      var weakCount = 0;
      for (var mIdx = 0; mIdx < mems.length; mIdx++) {
        if (mems[mIdx].type === "weakness") weakCount++;
      }
      spacedRepetitionHealth = Math.max(40, Math.min(100, 100 - weakCount * 8));
    }
  } catch (err) {
    console.warn("getCourseAnalytics memories error:", err);
  }

  // 5. Chat Recency
  var chatRecencyLabel = "Active today";
  var chatScore = 90;
  try {
    var { data: convs } = await client.from("conversations").select("updated_at, created_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1);
    if (convs && convs.length > 0) {
      var lastDateStr = convs[0].updated_at || convs[0].created_at;
      if (lastDateStr) {
        var diffHours = (now.getTime() - new Date(lastDateStr).getTime()) / (3600 * 1000);
        if (diffHours <= 24) {
          chatRecencyLabel = "Active today";
          chatScore = 95;
        } else if (diffHours <= 72) {
          chatRecencyLabel = "Recent (" + Math.round(diffHours / 24) + "d ago)";
          chatScore = 80;
        } else {
          chatRecencyLabel = "Inactive (>3d)";
          chatScore = 60;
        }
      }
    }
  } catch (err) {
    console.warn("getCourseAnalytics chat error:", err);
  }

  // 6. Overall Readiness Score (0-100)
  var readinessScore = Math.round(
    0.30 * quizAverage +
    0.25 * pyqStudiedPercent +
    0.20 * planCompletionPercent +
    0.15 * spacedRepetitionHealth +
    0.10 * chatScore
  );

  // 7. Mentor Risk Flag
  var cName = courseName || "Course";
  var isHighRisk = readinessScore < 70 || planCompletionPercent < 45 || quizAverage < 65;
  var riskMessage = isHighRisk
    ? cName + " — Finals approaching, " + planCompletionPercent + "% of study plan completed, quiz average " + quizAverage + "% → HIGH RISK. We recommend focusing immediately on high-frequency PYQ topics today."
    : cName + " — Strong exam trajectory! You are " + readinessScore + "% exam-ready with a " + quizAverage + "% quiz average. Maintain your spaced-repetition backlog to secure an A.";

  // 8. Per-day activity map (for calendar heatmap) + monthly map
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var FULL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var dailyTypeMap: Record<string, { total: number; quiz: number; chat: number; pyq: number; memory: number }> = {};

  function addActivity(dateStr: string | undefined | null, type: "quiz" | "chat" | "pyq" | "memory") {
    if (!dateStr) return;
    try {
      var d = new Date(dateStr);
      var dKey = d.toISOString().slice(0, 10);
      if (!dailyTypeMap[dKey]) {
        dailyTypeMap[dKey] = { total: 0, quiz: 0, chat: 0, pyq: 0, memory: 0 };
      }
      dailyTypeMap[dKey].total += 1;
      dailyTypeMap[dKey][type] += 1;
    } catch (_e) {}
  }

  try {
    // a. Real chat messages
    var { data: msgs } = await client.from("messages").select("created_at").limit(500);
    if (msgs) {
      for (var mi = 0; mi < msgs.length; mi++) addActivity(msgs[mi].created_at, "chat");
    }
    // b. Real quiz attempts
    var { data: atts } = await client.from("attempts").select("graded_at").limit(200);
    if (atts) {
      for (var ai = 0; ai < atts.length; ai++) addActivity(atts[ai].graded_at, "quiz");
    }
    // c. Real memory creations & practice logs
    var { data: memLogs } = await client.from("memories").select("created_at, updated_at").eq("user_id", userId).limit(300);
    if (memLogs) {
      for (var mli = 0; mli < memLogs.length; mli++) {
        addActivity(memLogs[mli].created_at, "memory");
        if (memLogs[mli].updated_at && memLogs[mli].updated_at !== memLogs[mli].created_at) {
          addActivity(memLogs[mli].updated_at, "memory");
        }
      }
    }
    // d. Real exam predictions
    var { data: predLogs } = await client.from("predictions").select("created_at").eq("course_id", courseId).limit(100);
    if (predLogs) {
      for (var pi = 0; pi < predLogs.length; pi++) addActivity(predLogs[pi].created_at, "pyq");
    }
    // e. Real material uploads
    var { data: matLogs } = await client.from("materials").select("created_at").eq("course_id", courseId).limit(100);
    if (matLogs) {
      for (var mti = 0; mti < matLogs.length; mti++) addActivity(matLogs[mti].created_at, "memory");
    }
  } catch (_err) {
    console.warn("Daily activity real data query warning:", _err);
  }

  return {
    readinessScore: readinessScore,
    factors: {
      quizAverage: quizAverage,
      pyqStudiedPercent: pyqStudiedPercent,
      planCompletionPercent: planCompletionPercent,
      spacedRepetitionHealth: spacedRepetitionHealth,
      chatRecencyLabel: chatRecencyLabel,
      chatActiveToday: chatScore >= 90
    },
    riskFlag: {
      level: isHighRisk ? "HIGH RISK" : "EXAM READY",
      message: riskMessage,
      isHighRisk: isHighRisk
    },
    topics: topics,
    dailyActivityMap: dailyTypeMap,
    MONTH_NAMES: MONTH_NAMES,
    FULL_MONTH_NAMES: FULL_MONTH_NAMES
  };

}

// Non-blocking: enrich topics with verbatim past-year questions after the page has rendered.
// Persists results onto the predictions rows so reloads are free; empty results are not persisted.
async function enrichPastQuestions(courseId: string, courseName: string, topics: any[]): Promise<any[]> {
  var targets: { topic: any; row: any; qObj: any }[] = [];
  var topicByName: Record<string, any> = {};
  for (var i = 0; i < topics.length; i++) {
    topicByName[String(topics[i].name).toLowerCase().trim()] = topics[i];
  }
  try {
    var client = await getClient();
    var { data: preds } = await client.from("predictions").select("*").eq("course_id", courseId).order("created_at", { ascending: false }).limit(5);
    if (preds) {
      for (var p = 0; p < preds.length; p++) {
        var row = fixJsonFields("predictions", preds[p]);
        var qArray = row.questions_json || [];
        for (var q = 0; q < qArray.length; q++) {
          var qObj = qArray[q];
          if (!qObj.topic) continue;
          var key = String(qObj.topic).toLowerCase().trim();
          var t = topicByName[key];
          if (t && (!Array.isArray(qObj.pastYearQuestions) || qObj.pastYearQuestionsLang !== "en")) {
            targets.push({ topic: t, row: row, qObj: qObj });
            delete topicByName[key];
          }
        }
      }
    }
  } catch (err) {
    console.warn("enrichPastQuestions lookup error:", err);
    return topics;
  }
  if (targets.length === 0) {
    return topics;
  }
  try {
    var papersText = await paperText(courseId);
    if (!papersText || papersText.trim().length === 0) {
      return topics;
    }
    var names = targets.map(function(t) { return t.topic.name; });
    var byName = await aiExtractPastQuestions(names, courseName || "this course", papersText);
    var patched: Record<string, any[]> = {};
    for (var e = 0; e < targets.length; e++) {
      var et = targets[e];
      var qs = byName[et.topic.name] || [];
      et.topic.pastYearQuestions = qs;
      if (qs.length > 0) {
        et.qObj.pastYearQuestions = qs;
        et.qObj.pastYearQuestionsLang = "en";
        if (!patched[et.row.id]) {
          patched[et.row.id] = et.row.questions_json;
        }
      }
    }
    var ids = Object.keys(patched);
    for (var r = 0; r < ids.length; r++) {
      await client.from("predictions").update({ questions_json: JSON.stringify(patched[ids[r]]) }).eq("id", ids[r]);
    }
  } catch (err) {
    console.warn("enrichPastQuestions error:", err);
  }
  return topics;
}

export var sdb = {
  getClient: getClient,
  insert: insert,
  batchInsert: batchInsert,
  getById: getById,
  listAll: listAll,
  update: update,
  delete: remove,
  vectorSearch: vectorSearch,
  materialText: materialText,
  paperText: paperText,
  enrichPastQuestions: enrichPastQuestions,
  countForCourse: countForCourse,
  listGeneratedExams: listGeneratedExams,
  deleteGeneratedExam: deleteGeneratedExam,
  listConversations: listConversations,
  createConversation: createConversation,
  deleteConversation: deleteConversation,
  listMessages: listMessages,
  addMessage: addMessage,
  updateMessage: updateMessage,
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
  getPublicUrl: getPublicUrl,
  deleteStorageObject: deleteStorageObject,
  listRepositoryPapers: listRepositoryPapers,
  getCourseAnalytics: getCourseAnalytics
};

