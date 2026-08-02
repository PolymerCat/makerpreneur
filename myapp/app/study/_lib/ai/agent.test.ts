import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent, AgentEvent } from "./agent";
import { llm } from "./gemini";
import * as toolsModule from "./tools";

vi.mock("./gemini", () => ({
  llm: {
    generateContent: vi.fn(),
    generateContentStream: vi.fn()
  }
}));

describe("Agent Loop & Parallel Tool Execution Stress Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should yield text and done events when model makes no tool calls", async () => {
    const mockGenerateContent = vi.mocked(llm.generateContent);
    mockGenerateContent.mockResolvedValueOnce({
      text: "Hello, student! How can I help you?",
      functionCalls: [],
      usage: { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 15 }
    });

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

  it("should enforce max 4 turns iteration limit when model endlessly calls tools", async () => {
    const mockGenerateContent = vi.mocked(llm.generateContent);
    mockGenerateContent.mockResolvedValue({
      text: "",
      functionCalls: [{ name: "translate_text", args: { text: "hello", targetLanguage: "Spanish" } }],
      usage: { model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 10 }
    });

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
    const mockGenerateContent = vi.mocked(llm.generateContent);

    // Turn 0: returns 2 simultaneous tool calls
    mockGenerateContent.mockResolvedValueOnce({
      text: "",
      functionCalls: [
        { name: "translate_text", args: { text: "hello", targetLanguage: "Malay" } },
        { name: "search_memory", args: { query: "preferences" } }
      ],
      usage: { model: "gemini-3.6-flash", inputTokens: 20, outputTokens: 30 }
    });

    // Turn 1: model returns final answer after receiving tool results
    mockGenerateContent.mockResolvedValueOnce({
      text: "Translated and retrieved memory successfully.",
      functionCalls: [],
      usage: { model: "gemini-3.6-flash", inputTokens: 50, outputTokens: 20 }
    });

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

    // Inspect message history passed to second generateContent call
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    const messagesArg = mockGenerateContent.mock.calls[1][0];

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
    const mockGenerateContent = vi.mocked(llm.generateContent);

    // Turn 0: returns 3 simultaneous tool calls
    mockGenerateContent.mockResolvedValueOnce({
      text: "",
      functionCalls: [
        { name: "search_material", args: { question: "thermodynamics" } },
        { name: "search_memory", args: { query: "weakness" } },
        { name: "get_exam_readiness", args: {} }
      ],
      usage: { model: "gemini-3.6-flash", inputTokens: 30, outputTokens: 40 }
    });

    // Turn 1: final answer
    mockGenerateContent.mockResolvedValueOnce({
      text: "Here is your study summary based on 3 tools.",
      functionCalls: [],
      usage: { model: "gemini-3.6-flash", inputTokens: 80, outputTokens: 25 }
    });

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
    const secondCallMessages = mockGenerateContent.mock.calls[1][0];
    const roles = secondCallMessages.map((m: any) => m.role);
    const hasConsecutiveUserRoles = roles.some((role: string, idx: number) => idx > 0 && role === "user" && roles[idx - 1] === "user");
    expect(hasConsecutiveUserRoles).toBe(false);
  });
});
