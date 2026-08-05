import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeTool, toolsRegistry, ToolCtx } from "./tools";
import { sdb } from "../supabase-db";
import * as actions from "../../actions";
import { llm } from "./gemini";

vi.mock("./gemini", () => ({
  llm: {
    embedTexts: vi.fn()
  }
}));

const { mockSupabaseSelect, mockSupabaseEq, mockSupabaseOrder, mockSupabaseLimit, mockSupabaseClient } = vi.hoisted(() => {
  const selectFn = vi.fn();
  const eqFn = vi.fn();
  const orderFn = vi.fn();
  const limitFn = vi.fn();
  const client = {
    from: (table: string) => ({
      select: (...args: any[]) => {
        selectFn(table, ...args);
        return {
          eq: (col: string, val: any) => {
            eqFn(table, col, val);
            return {
              eq: (col2: string, val2: any) => {
                eqFn(table, col2, val2);
                return Promise.resolve({ data: [{ id: "fallback-mat-1" }] });
              },
              order: (...oArgs: any[]) => {
                orderFn(table, ...oArgs);
                return {
                  limit: (...lArgs: any[]) => {
                    limitFn(table, ...lArgs);
                    return Promise.resolve({ data: [{ id: "plan-1", exam_date: "2026-12-01", goals: "Pass Exam" }] });
                  },
                  eq: (col3: string, val3: any) => {
                    eqFn(table, col3, val3);
                    return Promise.resolve({ data: [{ id: "day-1", day_number: 1, date: "2026-12-01", done: false, tasks: ["Read chapter 1"] }] });
                  }
                };
              },
              then: (resolve: any) => resolve({ data: [{ id: "paper-1", year: "2024", file_url: "http://example.com/MathPYQ2024.pdf", extracted_text: "Find the derivative of x squared" }] })
            };
          }
        };
      }
    })
  };
  return {
    mockSupabaseSelect: selectFn,
    mockSupabaseEq: eqFn,
    mockSupabaseOrder: orderFn,
    mockSupabaseLimit: limitFn,
    mockSupabaseClient: client
  };
});

vi.mock("../supabase-db", () => ({
  sdb: {
    getClient: vi.fn(async () => mockSupabaseClient),
    vectorSearch: vi.fn(),
    memorySearch: vi.fn(),
    listMemories: vi.fn(),
    insert: vi.fn(),
    batchInsert: vi.fn(),
    getCourseAnalytics: vi.fn()
  }
}));

vi.mock("../../actions", () => ({
  aiMakeFlashcards: vi.fn(),
  aiMakeQuiz: vi.fn(),
  aiTranslate: vi.fn(),
  aiSaveMemory: vi.fn(),
  aiGeneratePdfExam: vi.fn(),
  aiEmbedQuery: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => mockSupabaseClient)
}));

describe("Agent Tools Comprehensive Stress Tests", () => {
  const defaultCtx: ToolCtx = {
    userId: "user-123",
    subjectId: "subj-456",
    language: "en",
    materialIds: ["mat-1", "mat-2"]
  };

  const emptyMaterialCtx: ToolCtx = {
    userId: "user-123",
    subjectId: "subj-456",
    language: "en",
    materialIds: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have all 11 tools registered", () => {
    const expectedTools = [
      "search_material",
      "search_memory",
      "list_memories",
      "save_memory",
      "generate_flashcards",
      "generate_quiz",
      "get_exam_readiness",
      "get_study_plan",
      "search_past_papers",
      "translate_text",
      "generate_exam_paper"
    ];

    expectedTools.forEach((toolName) => {
      expect(toolsRegistry[toolName]).toBeDefined();
      expect(toolsRegistry[toolName].description).toBeTruthy();
    });
  });

  it("should handle unknown tools gracefully", async () => {
    const res = await executeTool("unknown_tool", {}, defaultCtx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Unknown tool");
    }
  });

  /* 1. search_material */
  describe("1. search_material tool", () => {
    it("handles empty/missing question argument", async () => {
      const res = await executeTool("search_material", { question: "   " }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Question argument is required");
    });

    it("handles valid search with provided materialIds", async () => {
      vi.mocked(llm.embedTexts).mockResolvedValueOnce([[0.1, 0.2]]);
      vi.mocked(sdb.vectorSearch).mockResolvedValue([
        { id: "c1", materialId: "mat-1", chunkIndex: 0, text: "Newton's first law of motion" }
      ]);

      const res = await executeTool("search_material", { question: "Newton laws", topK: 5 }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Newton's first law of motion");
      }
    });

    it("fallbacks to subjectId materials when materialIds is empty", async () => {
      vi.mocked(llm.embedTexts).mockResolvedValueOnce([[0.1, 0.2]]);
      vi.mocked(sdb.vectorSearch).mockResolvedValue([
        { id: "fallback-c1", materialId: "fallback-mat-1", chunkIndex: 0, text: "Fallback course material text" }
      ]);

      const res = await executeTool("search_material", { question: "General course query" }, emptyMaterialCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Fallback course material text");
      }
    });

    it("handles error in embedding or vector search gracefully", async () => {
      vi.mocked(llm.embedTexts).mockRejectedValueOnce(new Error("Embedding service failure"));
      const res = await executeTool("search_material", { question: "Error test" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Embedding service failure");
    });
  });

  /* 2. search_memory */
  describe("2. search_memory tool", () => {
    it("handles empty/missing query argument", async () => {
      const res = await executeTool("search_memory", { query: "" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Query argument is required");
    });

    it("returns formatted memories when matches found", async () => {
      vi.mocked(actions.aiEmbedQuery).mockResolvedValueOnce([0.1]);
      vi.mocked(sdb.memorySearch).mockResolvedValueOnce([
        { type: "weakness", content: "Struggles with calculus integration by parts", importance: 0.8 }
      ]);

      const res = await executeTool("search_memory", { query: "calculus" }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Struggles with calculus integration by parts");
      }
    });

    it("returns fallback message when no memories found", async () => {
      vi.mocked(actions.aiEmbedQuery).mockResolvedValueOnce([0.1]);
      vi.mocked(sdb.memorySearch).mockResolvedValueOnce([]);

      const res = await executeTool("search_memory", { query: "unknown topic" }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toBe("No matching memories found.");
      }
    });
  });

  /* 2b. list_memories */
  describe("2b. list_memories tool", () => {
    it("returns formatted memories newest-first", async () => {
      vi.mocked(sdb.listMemories).mockResolvedValueOnce([
        { type: "preference", content: "Preferred name: bibi", importance: 0.8 },
        { type: "weakness", content: "Struggles with calculus", importance: 0.7 },
        { type: "episode", content: "covered 5G protocols", importance: 0.5 }
      ]);

      const res = await executeTool("list_memories", {}, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("[preference] Preferred name: bibi");
        expect(res.result).toContain("[weakness] Struggles with calculus");
        expect(res.result).not.toContain("episode");
      }
    });

    it("filters by type when requested", async () => {
      vi.mocked(sdb.listMemories).mockResolvedValueOnce([
        { type: "preference", content: "Preferred name: bibi", importance: 0.8 },
        { type: "weakness", content: "Struggles with calculus", importance: 0.7 }
      ]);

      const res = await executeTool("list_memories", { type: "preference" }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("[preference] Preferred name: bibi");
        expect(res.result).not.toContain("Struggles with calculus");
      }
    });

    it("returns fallback message when no memories found", async () => {
      vi.mocked(sdb.listMemories).mockResolvedValueOnce([]);
      const res = await executeTool("list_memories", {}, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toBe("No memories found.");
      }
    });
  });

  /* 3. save_memory */
  describe("3. save_memory tool", () => {
    it("handles empty/missing content argument", async () => {
      const res = await executeTool("save_memory", { content: "  ", type: "fact" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Content is required");
    });

    it("successfully saves memory and returns confirmation", async () => {
      vi.mocked(actions.aiSaveMemory).mockResolvedValueOnce(true);
      const res = await executeTool("save_memory", { content: "Prefers concise bullet points", type: "preference", tags: ["style"] }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Memory saved successfully");
      }
    });

    it("handles database save failure", async () => {
      vi.mocked(actions.aiSaveMemory).mockResolvedValueOnce(false);
      const res = await executeTool("save_memory", { content: "Prefers video lectures", type: "preference" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Failed to save memory");
    });
  });

  /* 4. generate_flashcards */
  describe("4. generate_flashcards tool", () => {
    it("handles missing topic argument", async () => {
      const res = await executeTool("generate_flashcards", { topic: "" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Topic is required");
    });

    it("creates flashcard deck and cards in database", async () => {
      vi.mocked(actions.aiMakeFlashcards).mockResolvedValueOnce([
        { front: "What is Ohm's Law?", back: "V = IR" }
      ]);
      vi.mocked(sdb.insert).mockResolvedValueOnce({ id: "deck-123" });
      vi.mocked(sdb.batchInsert).mockResolvedValueOnce([]);

      const res = await executeTool("generate_flashcards", { topic: "Ohm's Law", cardCount: 5 }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Flashcard deck created successfully!");
        expect(res.result).toContain("/study/flashcards/deck-123");
      }
    });

    it("handles AI generation failure", async () => {
      vi.mocked(actions.aiMakeFlashcards).mockResolvedValueOnce([]);
      const res = await executeTool("generate_flashcards", { topic: "Physics" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("AI failed to generate flashcards");
    });
  });

  /* 5. generate_quiz */
  describe("5. generate_quiz tool", () => {
    it("handles missing topic argument", async () => {
      const res = await executeTool("generate_quiz", { topic: "" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Topic is required");
    });

    it("creates quiz and questions in database", async () => {
      vi.mocked(actions.aiMakeQuiz).mockResolvedValueOnce([
        { prompt: "What is 2+2?", kind: "mcq", options: ["3", "4"], answer: "4", rubric: null }
      ]);
      vi.mocked(sdb.insert).mockResolvedValueOnce({ id: "quiz-999" });
      vi.mocked(sdb.batchInsert).mockResolvedValueOnce([]);

      const res = await executeTool("generate_quiz", { topic: "Basic Math", questionCount: 1 }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Quiz created successfully!");
        expect(res.result).toContain("/study/quizzes/quiz-999");
      }
    });
  });

  /* 6. get_exam_readiness */
  describe("6. get_exam_readiness tool", () => {
    it("fetches course analytics and formats stats string", async () => {
      vi.mocked(sdb.getCourseAnalytics).mockResolvedValueOnce({
        quizAverage: 85,
        planCompletionPercent: 90,
        pyqStudiedPercent: 80,
        topics: [{ name: "Linear Algebra", isUrgent: true, mastery: 45, pyqFrequency: 90 }]
      });

      const res = await executeTool("get_exam_readiness", {}, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Subject ID: subj-456");
        expect(res.result).toContain("Quiz Average Score: 85%");
        expect(res.result).toContain("Linear Algebra");
      }
    });

    it("handles analytics failure", async () => {
      vi.mocked(sdb.getCourseAnalytics).mockRejectedValueOnce(new Error("DB error"));
      const res = await executeTool("get_exam_readiness", {}, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("get_exam_readiness error: DB error");
    });
  });

  /* 7. get_study_plan */
  describe("7. get_study_plan tool", () => {
    it("fetches study plan from database", async () => {
      const res = await executeTool("get_study_plan", { dayNumber: 1 }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Study Plan");
      }
    });
  });

  /* 8. search_past_papers */
  describe("8. search_past_papers tool", () => {
    it("searches past papers matching query keyword", async () => {
      const res = await executeTool("search_past_papers", { query: "Math" }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("Paper: MathPYQ2024.pdf");
      }
    });
  });

  /* 9. translate_text */
  describe("9. translate_text tool", () => {
    it("handles missing text argument", async () => {
      const res = await executeTool("translate_text", { text: "" }, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Text is required");
    });

    it("translates text using aiTranslate", async () => {
      vi.mocked(actions.aiTranslate).mockResolvedValueOnce("Selamat pagi");
      const res = await executeTool("translate_text", { text: "Good morning", targetLanguage: "Bahasa Melayu" }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.result).toBe("Selamat pagi");
    });
  });

  /* 10. generate_exam_paper */
  describe("10. generate_exam_paper tool", () => {
    it("generates exam paper PDF via aiGeneratePdfExam", async () => {
      vi.mocked(actions.aiGeneratePdfExam).mockResolvedValueOnce({
        fileUrl: "http://example.com/exam.pdf",
        title: "Midterm Physics",
        courseCode: "PHY101"
      });

      const res = await executeTool("generate_exam_paper", { paperIds: ["p1"] }, defaultCtx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toContain("PDF Link: http://example.com/exam.pdf");
      }
    });

    it("handles failure when PDF generation fails", async () => {
      vi.mocked(actions.aiGeneratePdfExam).mockResolvedValueOnce({ fileUrl: "" } as any);
      const res = await executeTool("generate_exam_paper", {}, defaultCtx);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toContain("Failed to generate PDF exam paper");
    });
  });
});
