import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent, AgentEvent } from "./agent";
import { llm } from "./gemini";
import * as toolsModule from "./tools";

vi.mock("./gemini", () => ({
  llm: {
    generateContentStreamWithTools: vi.fn(),
    classifyRoute: vi.fn()
  },
  SMALL_CHAT_SLOTS: [{ provider: "openrouter", model: "mock-small-model" }]
}));

function streamOf(events: any[]): any {
  return async function* () {
    for (const ev of events) {
      yield ev;
    }
  };
}

describe("Agent Loop & Parallel Tool Execution Stress Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should yield text and done events when model makes no tool calls", async () => {
    const mockClassify = vi.mocked(llm.classifyRoute);
    mockClassify.mockResolvedValueOnce("chat");
    const mockStream = vi.mocked(llm.generateContentStreamWithTools);
    mockStream.mockImplementationOnce(streamOf([
      { type: "text_delta", content: "Hello, student! How can I help you?" },
      { type: "tool_calls", calls: [], usage: { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 15 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 15 } }
    ]));

    const generator = runAgent({
      userId: "user-1",
      question: "Hello",
      subjectId: "subj-1",
      language: "en"
    });

    const events: AgentEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ type: "text", content: "Hello, student! How can I help you?" });
    expect(events[1]).toEqual({ type: "done", toolCount: 0 });
  });

  it("should stream a canned confirmation with the artifact link after a successful generate_quiz, without a second LLM probe", async () => {
    const mockClassify = vi.mocked(llm.classifyRoute);
    mockClassify.mockResolvedValueOnce("tool");
    const mockStream = vi.mocked(llm.generateContentStreamWithTools);
    mockStream.mockImplementationOnce(streamOf([
      { type: "tool_calls", calls: [{ name: "generate_quiz", args: { questionCount: 5, topic: "Networking" } }], usage: { model: "gemini-3.6-flash", inputTokens: 20, outputTokens: 30 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 20, outputTokens: 30 } }
    ]));

    const executeSpy = vi.spyOn(toolsModule, "executeTool").mockResolvedValue({
      ok: true,
      result: "Quiz created successfully! Quiz URL: /study/quizzes/123e4567-e89b-12d3-a456-426614174000 (Total Questions: 5)."
    });

    const generator = runAgent({
      userId: "user-1",
      question: "Generate a 5-question quiz",
      subjectId: "subj-1",
      language: "en"
    });

    const events: AgentEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(events[0]).toEqual({ type: "tool_start", tool: "generate_quiz" });
    expect(events[2].type).toBe("text");
    expect((events[2] as any).content).toContain("/study/quizzes/123e4567-e89b-12d3-a456-426614174000");
    expect(events[3]).toEqual({ type: "done", toolCount: 1 });
  });

  it("should enforce max 4 turns iteration limit when model endlessly calls tools", async () => {
    const mockClassify = vi.mocked(llm.classifyRoute);
    mockClassify.mockResolvedValueOnce("tool");
    const mockStream = vi.mocked(llm.generateContentStreamWithTools);
    mockStream.mockImplementation(streamOf([
      { type: "tool_calls", calls: [{ name: "translate_text", args: { text: "hello", targetLanguage: "Spanish" } }], usage: { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 10 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 10 } }
    ]));

    const generator = runAgent({
      userId: "user-1",
      question: "Translate hello repeatedly",
      subjectId: "subj-1",
      language: "en"
    });

    const events: AgentEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const toolStarts = events.filter((e) => e.type === "tool_start");
    expect(toolStarts.length).toBe(4);
    const lastEvent = events[events.length - 1];
    expect(lastEvent).toEqual({ type: "done", toolCount: 4 });
  });

  it("stress-tests 2 simultaneous tool calls in a single turn: verify execution order, events, and message history formatting", async () => {
    const mockClassify = vi.mocked(llm.classifyRoute);
    mockClassify.mockResolvedValueOnce("tool");
    const mockStream = vi.mocked(llm.generateContentStreamWithTools);

    // Turn 0: returns 2 simultaneous tool calls
    mockStream.mockImplementationOnce(streamOf([
      { type: "tool_calls", calls: [
        { name: "translate_text", args: { text: "hello", targetLanguage: "Malay" } },
        { name: "search_memory", args: { query: "preferences" } }
      ], usage: { model: "gemini-3.6-flash", inputTokens: 20, outputTokens: 30 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 20, outputTokens: 30 } }
    ]));

    // Turn 1: model returns final answer after receiving tool results
    mockStream.mockImplementationOnce(streamOf([
      { type: "text_delta", content: "Translated and retrieved memory successfully." },
      { type: "tool_calls", calls: [], usage: { model: "gemini-3.6-flash", inputTokens: 50, outputTokens: 20 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 50, outputTokens: 20 } }
    ]));

    const executeSpy = vi.spyOn(toolsModule, "executeTool").mockImplementation(async (name) => {
      return { ok: true, result: `Result of ${name}` };
    });

    const generator = runAgent({
      userId: "user-1",
      question: "Translate hello and check my preferences",
      subjectId: "subj-1",
      language: "en"
    });

    const events: AgentEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    // Verify events sequence
    expect(events[0]).toEqual({ type: "tool_start", tool: "translate_text" });
    expect(events[1].type).toBe("tool_end");
    expect((events[1] as any).tool).toBe("translate_text");

    expect(events[2]).toEqual({ type: "tool_start", tool: "search_memory" });
    expect(events[3].type).toBe("tool_end");
    expect((events[3] as any).tool).toBe("search_memory");

    expect(events[4]).toEqual({ type: "text", content: "Translated and retrieved memory successfully." });
    expect(events[5]).toEqual({ type: "done", toolCount: 2 });

    // Verify tool execution order
    expect(executeSpy).toHaveBeenNthCalledWith(1, "translate_text", { text: "hello", targetLanguage: "Malay" }, expect.anything());
    expect(executeSpy).toHaveBeenNthCalledWith(2, "search_memory", { query: "preferences" }, expect.anything());

    // Inspect message history passed to second stream call
    expect(mockStream).toHaveBeenCalledTimes(2);
    const messagesArg = mockStream.mock.calls[1][0];

    // Check message history structure:
    // Index 0: User prompt
    // Index 1: Model functionCalls
    // Index 2+: User function responses
    console.log("Message history passed to turn 2:", JSON.stringify(messagesArg, null, 2));

    // Verify if tool responses are combined into a single user message or pushed as consecutive user messages
    const roles = messagesArg.map((m: any) => m.role);
    console.log("Roles order in message history:", roles);

    // Check whether consecutive user turns exist (e.g. ['user', 'model', 'user', 'user'])
    const hasConsecutiveUserRoles = roles.some((role: string, idx: number) => idx > 0 && role === "user" && roles[idx - 1] === "user");
    expect(hasConsecutiveUserRoles).toBe(false); // In Gemini API spec, function responses for parallel tool calls should be in a single user turn
  });

  it("stress-tests 3 simultaneous tool calls in a single turn", async () => {
    const mockClassify = vi.mocked(llm.classifyRoute);
    mockClassify.mockResolvedValueOnce("tool");
    const mockStream = vi.mocked(llm.generateContentStreamWithTools);

    // Turn 0: returns 3 simultaneous tool calls
    mockStream.mockImplementationOnce(streamOf([
      { type: "tool_calls", calls: [
        { name: "search_material", args: { question: "thermodynamics" } },
        { name: "search_memory", args: { query: "weakness" } },
        { name: "get_exam_readiness", args: {} }
      ], usage: { model: "gemini-3.6-flash", inputTokens: 30, outputTokens: 40 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 30, outputTokens: 40 } }
    ]));

    // Turn 1: final answer
    mockStream.mockImplementationOnce(streamOf([
      { type: "text_delta", content: "Here is your study summary based on 3 tools." },
      { type: "tool_calls", calls: [], usage: { model: "gemini-3.6-flash", inputTokens: 80, outputTokens: 25 } },
      { type: "end", usage: { model: "gemini-3.6-flash", inputTokens: 80, outputTokens: 25 } }
    ]));

    vi.spyOn(toolsModule, "executeTool").mockImplementation(async (name) => {
      return { ok: true, result: `Mock response for ${name}` };
    });

    const generator = runAgent({
      userId: "user-100",
      question: "Help me review thermodynamics",
      subjectId: "subj-100",
      language: "en"
    });

    const events: AgentEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const toolStarts = events.filter((e) => e.type === "tool_start");
    expect(toolStarts.length).toBe(3);
    expect(toolStarts.map((e: any) => e.tool)).toEqual(["search_material", "search_memory", "get_exam_readiness"]);

    const doneEvent = events[events.length - 1];
    expect(doneEvent).toEqual({ type: "done", toolCount: 3 });

    // Verify messages passed to model turn 2
    const secondCallMessages = mockStream.mock.calls[1][0];
    const roles = secondCallMessages.map((m: any) => m.role);
    const hasConsecutiveUserRoles = roles.some((role: string, idx: number) => idx > 0 && role === "user" && roles[idx - 1] === "user");
    expect(hasConsecutiveUserRoles).toBe(false);
  });

  it("should route simple chat through the small-model path with no tools", async () => {
    const mockClassify = vi.mocked(llm.classifyRoute);
    mockClassify.mockResolvedValueOnce("chat");
    const mockStream = vi.mocked(llm.generateContentStreamWithTools);
    mockStream.mockImplementationOnce(streamOf([
      { type: "text_delta", content: "Hi! How can I help you study?" },
      { type: "tool_calls", calls: [], usage: { model: "openai/gpt-oss-120b:nitro", inputTokens: 5, outputTokens: 8 } },
      { type: "end", usage: { model: "openai/gpt-oss-120b:nitro", inputTokens: 5, outputTokens: 8 } }
    ]));

    const generator = runAgent({
      userId: "user-1",
      question: "hi",
      subjectId: "subj-1",
      language: "en"
    });

    const events: AgentEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(mockClassify).toHaveBeenCalledWith("hi");
    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamOpts = mockStream.mock.calls[0][1] as any;
    expect(streamOpts.tools).toEqual([]);
    expect(streamOpts.task).toBe("agent_chat");
    expect(streamOpts.slots).toEqual([{ provider: "openrouter", model: "mock-small-model" }]);
    expect(events[0]).toEqual({ type: "text", content: "Hi! How can I help you study?" });
    expect(events[1]).toEqual({ type: "done", toolCount: 0 });
  });
});
