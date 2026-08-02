import { sdb } from "../supabase-db";
import {
  aiMakeFlashcards,
  aiMakeQuiz,
  aiTranslate,
  aiSaveMemory,
  aiGeneratePdfExam,
  aiEmbedQuery
} from "../../actions";
import { retrieveChunks } from "./retrieve";

export type ToolResult =
  | { ok: true; result: string }
  | { ok: false; error: string };

export type ToolCtx = {
  userId: string;
  subjectId: string;
  language: string;
  materialIds: string[];
};

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<ToolResult>;
};

const toolsRegistry: Record<string, ToolDef> = {};

function registerTool(def: ToolDef) {
  toolsRegistry[def.name] = def;
}

async function resolveFirstMaterialId(ctx: ToolCtx): Promise<string | null> {
  if (ctx.materialIds && ctx.materialIds.length > 0) {
    console.log(`[TOOLS] Using explicitly provided material ID: ${ctx.materialIds[0]}`);
    return ctx.materialIds[0];
  }
  try {
    const supabase = await sdb.getClient();

    if (ctx.subjectId) {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, status")
        .eq("course_id", ctx.subjectId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        console.log(`[TOOLS] Resolved uploaded material "${data[0].title}" (ID: ${data[0].id}, status: ${data[0].status}) for subject ${ctx.subjectId}`);
        return data[0].id;
      }
    }

    const { data: globalData, error: globalErr } = await supabase
      .from("materials")
      .select("id, title, status")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!globalErr && globalData && globalData.length > 0) {
      console.log(`[TOOLS] Resolved fallback uploaded material "${globalData[0].title}" (ID: ${globalData[0].id})`);
      return globalData[0].id;
    }
  } catch (err: any) {
    console.error(`[TOOLS] Error in resolveFirstMaterialId:`, err?.message || err);
  }
  return null;
}

/* 1. search_material */
registerTool({
  name: "search_material",
  description: "Search uploaded course materials for relevant concepts, definitions, formulas, and explanations.",
  parameters: {
    type: "OBJECT",
    properties: {
      question: { type: "STRING", description: "Search question or keywords" },
      topK: { type: "NUMBER", description: "Optional number of top chunks to return" }
    },
    required: ["question"]
  },
  run: async (args, ctx) => {
    try {
      const question = String(args.question || "").trim();
      if (!question) return { ok: false, error: "Question argument is required for search_material" };

      let targetMaterialIds = ctx.materialIds || [];
      if (targetMaterialIds.length === 0 && ctx.subjectId) {
        try {
          const supabase = await sdb.getClient();
          const { data } = await supabase
            .from("materials")
            .select("id")
            .eq("course_id", ctx.subjectId)
            .eq("status", "ready");
          if (data) {
            targetMaterialIds = data.map((m: any) => m.id);
          }
        } catch (_err) {
          /* fallback search without target filter */
        }
      }

      if (targetMaterialIds.length === 0) {
        return { ok: true, result: "No course materials selected or found for this subject." };
      }

      const topK = typeof args.topK === "number" ? args.topK : 8;
      const winning = await retrieveChunks(question, targetMaterialIds, topK);

      if (winning.length === 0) {
        return { ok: true, result: "No relevant content found in the course materials for: " + question };
      }

      const formatted = winning
        .map((c, i) => `[${i + 1}] ${c.text}`)
        .join("\n\n");

      return {
        ok: true,
        result: formatted
      };
    } catch (err: any) {
      return { ok: false, error: "search_material error: " + (err.message || String(err)) };
    }
  }
});

/* 2. search_memory */
registerTool({
  name: "search_memory",
  description: "Search stored memories and facts about the student's background, preferences, goals, or weaknesses.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: { type: "STRING", description: "Query to search memory" }
    },
    required: ["query"]
  },
  run: async (args, ctx) => {
    try {
      const query = String(args.query || "").trim();
      if (!query) return { ok: false, error: "Query argument is required for search_memory" };

      const queryEmbedding = await aiEmbedQuery(query);
      const matches = await sdb.memorySearch(ctx.userId, ctx.subjectId || null, queryEmbedding, 8);

      if (matches.length === 0) {
        return { ok: true, result: "No matching memories found." };
      }

      const formatted = matches
        .map((m: any) => `-[${m.type}] ${m.content} (importance: ${m.importance || 0.5})`)
        .join("\n");

      return { ok: true, result: formatted };
    } catch (err: any) {
      return { ok: false, error: "search_memory error: " + (err.message || String(err)) };
    }
  }
});

/* 3. save_memory */
registerTool({
  name: "save_memory",
  description: "Save a new persistent memory or fact about the student (e.g. weakness, goal, preference).",
  parameters: {
    type: "OBJECT",
    properties: {
      content: { type: "STRING", description: "Content of the memory to save" },
      type: {
        type: "STRING",
        enum: ["fact", "preference", "goal", "weakness"],
        description: "Memory category"
      },
      tags: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "Optional tags"
      }
    },
    required: ["content", "type"]
  },
  run: async (args, ctx) => {
    try {
      const content = String(args.content || "").trim();
      const type = String(args.type || "fact").trim();
      const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];

      if (!content) return { ok: false, error: "Content is required for save_memory" };

      const success = await aiSaveMemory(ctx.subjectId || null, type, content, tags);
      if (success) {
        return { ok: true, result: `Memory saved successfully: [${type}] ${content}` };
      } else {
        return { ok: false, error: "Failed to save memory to database." };
      }
    } catch (err: any) {
      return { ok: false, error: "save_memory error: " + (err.message || String(err)) };
    }
  }
});

/* 4. generate_flashcards */
registerTool({
  name: "generate_flashcards",
  description: "Generate flashcards for study/revision on a specific topic or material.",
  parameters: {
    type: "OBJECT",
    properties: {
      topic: { type: "STRING", description: "Study topic or material summary to generate flashcards from" },
      cardCount: { type: "NUMBER", description: "Number of flashcards to generate (default 10)" }
    },
    required: ["topic"]
  },
  run: async (args, ctx) => {
    const started = Date.now();
    try {
      const topic = String(args.topic || "").trim();
      const cardCount = typeof args.cardCount === "number" && args.cardCount > 0 ? args.cardCount : 10;
      console.log(`[TOOL-START] [generate_flashcards] Topic: "${topic}", Requested Cards: ${cardCount}`);

      if (!topic) return { ok: false, error: "Topic is required for generate_flashcards" };

      const materialId = await resolveFirstMaterialId(ctx);
      if (!materialId) {
        console.warn(`[TOOL-WARN] [generate_flashcards] No uploaded material found for subjectId=${ctx.subjectId}`);
        return { ok: false, error: "No course material found. Please upload a PDF material for this subject first." };
      }

      // Retrieve actual text content from the uploaded PDF material
      let sourceText = topic;
      try {
        const chunks = await retrieveChunks(topic, [materialId], 6);
        if (chunks && chunks.length > 0) {
          sourceText = chunks.map((c) => c.text).join("\n\n");
          console.log(`[TOOL-CHUNKS] [generate_flashcards] Extracted ${chunks.length} text chunks from uploaded PDF material (ID: ${materialId}).`);
        }
      } catch (chunkErr: any) {
        console.warn(`[TOOL-WARN] [generate_flashcards] Could not retrieve chunks for uploaded material:`, chunkErr?.message || chunkErr);
      }

      const cardsData = await aiMakeFlashcards(sourceText, ctx.language || "en", cardCount);

      if (!cardsData || cardsData.length === 0) {
        console.warn(`[TOOL-WARN] [generate_flashcards] LLM returned no cards.`);
        return { ok: false, error: "AI failed to generate flashcards." };
      }

      let deckId = crypto.randomUUID();
      let deckSaved = false;
      let deckUrl = `/study/flashcards/${deckId}`;

      try {
        const deck = await sdb.insert("decks", {
          id: deckId,
          materialId: materialId,
          title: `Flashcards: ${topic.slice(0, 40)}`
        });
        if (deck?.id) deckId = deck.id;
        deckUrl = `/study/flashcards/${deckId}`;

        const cardsToInsert = cardsData.map((c: any) => ({
          deckId: deckId,
          front: c.front,
          back: c.back,
          easiness: 2.5,
          interval: 0,
          repetitions: 0,
          dueDate: new Date().toISOString()
        }));

        await sdb.batchInsert("cards", cardsToInsert);
        deckSaved = true;
        console.log(`[TOOL-DB] [generate_flashcards] Saved deck ${deckId} under material ${materialId} with ${cardsData.length} cards.`);
      } catch (dbErr: any) {
        console.error(`[TOOL-DB-ERROR] [generate_flashcards] Could not save deck to DB:`, dbErr);
      }

      console.log(`[TOOL-SUCCESS] [generate_flashcards] Done in ${Date.now() - started}ms. Saved to DB: ${deckSaved}`);

      return {
        ok: true,
        result: `Flashcard deck created successfully! Deck URL: ${deckUrl} (Total Cards: ${cardsData.length}).\n\n[INSTRUCTION FOR ASSISTANT]: The UI automatically renders the interactive Flashcard UI component for the student. Do NOT list or write out the individual flashcard questions or answers in your chat message text. Simply provide a short 1-sentence confirmation and include the deck link (${deckUrl}).`
      };
    } catch (err: any) {
      console.error(`[TOOL-ERROR] [generate_flashcards] Error:`, err);
      return { ok: false, error: "generate_flashcards error: " + (err.message || String(err)) };
    }
  }
});

/* 5. generate_quiz */
registerTool({
  name: "generate_quiz",
  description: "Generate practice quizzes with multiple choice, true/false, or essay questions for study topics.",
  parameters: {
    type: "OBJECT",
    properties: {
      topic: { type: "STRING", description: "Study topic or material summary to generate quiz from" },
      questionCount: { type: "NUMBER", description: "Number of questions to generate (default 5)" }
    },
    required: ["topic"]
  },
  run: async (args, ctx) => {
    const started = Date.now();
    try {
      const topic = String(args.topic || "").trim();
      const questionCount = typeof args.questionCount === "number" && args.questionCount > 0 ? args.questionCount : 5;
      console.log(`[TOOL-START] [generate_quiz] Topic: "${topic}", Questions: ${questionCount}`);

      if (!topic) return { ok: false, error: "Topic is required for generate_quiz" };

      const materialId = await resolveFirstMaterialId(ctx);
      if (!materialId) {
        console.warn(`[TOOL-WARN] [generate_quiz] No uploaded material found for subjectId=${ctx.subjectId}`);
        return { ok: false, error: "No course material found. Please upload a PDF material for this subject first." };
      }

      // Retrieve actual text content from the uploaded PDF material
      let sourceText = topic;
      try {
        const chunks = await retrieveChunks(topic, [materialId], 6);
        if (chunks && chunks.length > 0) {
          sourceText = chunks.map((c) => c.text).join("\n\n");
          console.log(`[TOOL-CHUNKS] [generate_quiz] Extracted ${chunks.length} text chunks from uploaded PDF material (ID: ${materialId}).`);
        }
      } catch (chunkErr: any) {
        console.warn(`[TOOL-WARN] [generate_quiz] Could not retrieve chunks for uploaded material:`, chunkErr?.message || chunkErr);
      }

      const questionsData = await aiMakeQuiz(sourceText, ctx.language || "en", questionCount);

      if (!questionsData || questionsData.length === 0) {
        console.warn(`[TOOL-WARN] [generate_quiz] LLM returned no quiz questions.`);
        return { ok: false, error: "AI failed to generate quiz questions." };
      }

      let quizId = crypto.randomUUID();
      let quizSaved = false;
      let quizUrl = `/study/quizzes/${quizId}`;

      try {
        const quiz = await sdb.insert("quizzes", {
          id: quizId,
          materialId: materialId,
          title: `Quiz: ${topic.slice(0, 40)}`
        });
        if (quiz?.id) quizId = quiz.id;
        quizUrl = `/study/quizzes/${quizId}`;

        const qToInsert = questionsData.map((q: any) => {
          var rubricVal = "";
          if (q.kind === "mcq" || q.kind === "tf") {
            rubricVal = q.explanations ? JSON.stringify(q.explanations) : "";
          } else {
            rubricVal = q.rubric || "";
          }
          var resolvedAns = q.answer ?? q.correctAnswer ?? q.solution ?? q.correct_answer ?? (Array.isArray(q.options) && q.options.length > 0 ? q.options[0] : "N/A");
          return {
            quizId: quiz.id || quizId,
            kind: q.kind || "mcq",
            prompt: q.prompt || "Question",
            options: q.options || [],
            answer: String(resolvedAns),
            rubric: rubricVal
          };
        });

        await sdb.batchInsert("questions", qToInsert);
        quizSaved = true;
        console.log(`[TOOL-DB] [generate_quiz] Saved quiz ${quizId} under material ${materialId} with ${questionsData.length} questions.`);
      } catch (dbErr: any) {
        console.error(`[TOOL-DB-ERROR] [generate_quiz] Could not save quiz to DB:`, dbErr);
      }

      console.log(`[TOOL-SUCCESS] [generate_quiz] Done in ${Date.now() - started}ms. Saved to DB: ${quizSaved}`);

      return {
        ok: true,
        result: `Quiz created successfully! Quiz URL: ${quizUrl} (Total Questions: ${questionsData.length}).\n\n[INSTRUCTION FOR ASSISTANT]: The UI automatically renders the interactive Quiz UI component for the student. Do NOT list or write out the individual quiz questions or choices in your chat message text. Simply provide a short 1-sentence confirmation and include the quiz link (${quizUrl}).`
      };
    } catch (err: any) {
      console.error(`[TOOL-ERROR] [generate_quiz] Error:`, err);
      return { ok: false, error: "generate_quiz error: " + (err.message || String(err)) };
    }
  }
});

/* 6. get_exam_readiness */
registerTool({
  name: "get_exam_readiness",
  description: "Get formatted raw stats on student exam readiness, quiz average scores, past paper attempts, and study plan progress.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: []
  },
  run: async (_args, ctx) => {
    try {
      const analytics = await sdb.getCourseAnalytics(ctx.subjectId, ctx.userId);
      const urgentTopics = analytics.topics ? analytics.topics.filter((t: any) => t.isUrgent) : [];
      const urgentTopicsStr = urgentTopics.length > 0
        ? urgentTopics.map((t: any) => `  * ${t.name} (Mastery: ${t.mastery}%, PYQ Freq: ${t.pyqFrequency}%)`).join("\n")
        : "  None";

      const formattedStats = `[Exam Readiness Stats]
- Subject ID: ${ctx.subjectId}
- Quiz Average Score: ${analytics.quizAverage ?? "N/A"}%
- Study Plan Progress: ${analytics.planCompletionPercent ?? "N/A"}%
- PYQ Concepts Studied: ${analytics.pyqStudiedPercent ?? "N/A"}%
- PYQ Topics Analyzed: ${analytics.topics ? analytics.topics.length : 0}
- Urgent Weak Topics (${urgentTopics.length}):
${urgentTopicsStr}`;

      return { ok: true, result: formattedStats };
    } catch (err: any) {
      return { ok: false, error: "get_exam_readiness error: " + (err.message || String(err)) };
    }
  }
});

/* 7. get_study_plan */
registerTool({
  name: "get_study_plan",
  description: "Get the student's study plan schedule, daily tasks, exam date, and completion status.",
  parameters: {
    type: "OBJECT",
    properties: {
      dayNumber: { type: "NUMBER", description: "Optional specific day number to view" }
    },
    required: []
  },
  run: async (args, ctx) => {
    try {
      const supabase = await sdb.getClient();

      const planRes = await supabase
        .from("study_plans")
        .select("*")
        .eq("course_id", ctx.subjectId)
        .order("exam_date", { ascending: false })
        .limit(1);

      if (!planRes.data || planRes.data.length === 0) {
        return { ok: true, result: "No active study plan found for this subject." };
      }

      const plan = planRes.data[0];
      const daysRes = await supabase
        .from("plan_days")
        .select("*")
        .eq("plan_id", plan.id)
        .order("day_number", { ascending: true });

      let days = daysRes.data || [];
      if (typeof args.dayNumber === "number") {
        days = days.filter((d: any) => d.day_number === args.dayNumber);
      }

      const dayLines = days
        .map((d: any) => {
          const tasksStr = Array.isArray(d.tasks) ? d.tasks.join(", ") : String(d.tasks || "");
          return `Day ${d.day_number} (${d.date}): [${d.done ? "COMPLETED" : "PENDING"}] ${d.topic} - Tasks: ${tasksStr}`;
        })
        .join("\n");

      const resultStr = `[Study Plan]
Exam Date: ${plan.exam_date || "Not set"}
Goals: ${plan.goals || "General revision"}
Schedule:\n${dayLines || "No daily tasks scheduled."}`;

      return { ok: true, result: resultStr };
    } catch (err: any) {
      return { ok: false, error: "get_study_plan error: " + (err.message || String(err)) };
    }
  }
});

/* 8. search_past_papers */
registerTool({
  name: "search_past_papers",
  description: "Search past year exam papers and questions by keyword or topic.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: { type: "STRING", description: "Search query or keyword for past papers" }
    },
    required: ["query"]
  },
  run: async (args, ctx) => {
    try {
      const query = String(args.query || "").trim().toLowerCase();
      const supabase = await sdb.getClient();

      const papersRes = await supabase
        .from("papers")
        .select("*")
        .eq("course_id", ctx.subjectId);

      const papers = papersRes.data || [];
      const matched = papers.filter((p: any) => {
        const title = p.file_url ? String(p.file_url).split("/").pop() || "" : "";
        if (!query) return true;
        const titleMatch = title.toLowerCase().includes(query);
        const textMatch = (p.extracted_text || "").toLowerCase().includes(query);
        const yearMatch = String(p.year || "").includes(query);
        return titleMatch || textMatch || yearMatch;
      });

      if (matched.length === 0) {
        return { ok: true, result: "No past papers found matching query: " + query };
      }

      const formatted = matched
        .map((p: any) => {
          const title = p.file_url ? String(p.file_url).split("/").pop() || "Past Paper" : "Past Paper";
          return `- Paper: ${title} | Year: ${p.year || "N/A"} | Semester: ${p.semester || "1"} | URL: ${p.file_url || "#"}`;
        })
        .join("\n");

      return { ok: true, result: formatted };
    } catch (err: any) {
      return { ok: false, error: "search_past_papers error: " + (err.message || String(err)) };
    }
  }
});

/* 9. translate_text */
registerTool({
  name: "translate_text",
  description: "Translate text to a target language (e.g. Bahasa Melayu, English).",
  parameters: {
    type: "OBJECT",
    properties: {
      text: { type: "STRING", description: "Text to translate" },
      targetLanguage: { type: "STRING", description: "Target language (e.g. Bahasa Melayu, English)" }
    },
    required: ["text", "targetLanguage"]
  },
  run: async (args) => {
    try {
      const text = String(args.text || "").trim();
      const targetLanguage = String(args.targetLanguage || "English").trim();
      if (!text) return { ok: false, error: "Text is required for translate_text" };

      const translated = await aiTranslate(text, targetLanguage);
      return { ok: true, result: translated };
    } catch (err: any) {
      return { ok: false, error: "translate_text error: " + (err.message || String(err)) };
    }
  }
});

/* 10. generate_exam_paper */
registerTool({
  name: "generate_exam_paper",
  description: "Generate a downloadable PDF past-year style examination paper for revision.",
  parameters: {
    type: "OBJECT",
    properties: {
      paperIds: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "Optional list of past paper IDs to use as style reference"
      }
    },
    required: []
  },
  run: async (args, ctx) => {
    try {
      const paperIds = Array.isArray(args.paperIds) ? args.paperIds.map(String) : [];
      const examRecord = await aiGeneratePdfExam(ctx.subjectId, paperIds);

      if (!examRecord || !examRecord.fileUrl) {
        return { ok: false, error: "Failed to generate PDF exam paper." };
      }

      return {
        ok: true,
        result: `Examination paper generated successfully!\nPDF Link: ${examRecord.fileUrl}\nTitle: ${examRecord.title || "Final Examination"} (${examRecord.courseCode || "Course Exam"})`
      };
    } catch (err: any) {
      return { ok: false, error: "generate_exam_paper error: " + (err.message || String(err)) };
    }
  }
});

export function buildGeminiTools() {
  const declarations = Object.values(toolsRegistry).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
  return [{ functionDeclarations: declarations }];
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolCtx
): Promise<ToolResult> {
  const tool = toolsRegistry[name];
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  return await tool.run(args || {}, ctx);
}

export { toolsRegistry };
