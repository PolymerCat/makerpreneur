import { describe, it, expect, vi, afterEach } from "vitest";
import { toOpenAITools, toOpenAIMessages, parseOpenAIChat, parseSSEChunk, parseJsonRepair, llm } from "./gemini";

describe("toOpenAITools", () => {
  it("converts functionDeclarations into OpenAI function tools", () => {
    const geminiTools = [
      { functionDeclarations: [
        { name: "search_material", description: "Search materials", parameters: { type: "OBJECT", properties: { q: { type: "STRING" } } } },
        { name: "generate_flashcards", description: "Make cards", parameters: { type: "OBJECT", properties: {} } }
      ] }
    ];
    const out = toOpenAITools(geminiTools);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      type: "function",
      function: { name: "search_material", description: "Search materials", parameters: { type: "object", properties: { q: { type: "string" } } } }
    });
    expect(out[1].function.name).toBe("generate_flashcards");
  });

  it("returns [] for falsy input", () => {
    expect(toOpenAITools(undefined as any)).toEqual([]);
    expect(toOpenAITools([])).toEqual([]);
  });

  it("lowercases Gemini uppercase type enums to OpenAI lowercase schema types", () => {
    const out = toOpenAITools([
      { functionDeclarations: [
        { name: "save_memory", description: "Save memory", parameters: {
          type: "OBJECT",
          properties: {
            content: { type: "STRING" },
            tags: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["content"]
        } }
      ] }
    ]);
    const p = out[0].function.parameters;
    expect(p.type).toBe("object");
    expect(p.properties.content.type).toBe("string");
    expect(p.properties.tags.type).toBe("array");
    expect(p.properties.tags.items.type).toBe("string");
    expect(p.required).toEqual(["content"]);
  });
});

describe("toOpenAIMessages", () => {
  it("converts plain text user messages to string content", () => {
    const out = toOpenAIMessages([{ role: "user", parts: [{ text: "hello" }] }]);
    expect(out).toEqual([{ role: "user", content: "hello" }]);
  });

  it("converts inlineData image parts to data-URL image_url content", () => {
    const out = toOpenAIMessages([
      { role: "user", parts: [
        { text: "look at this" },
        { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } }
      ] }
    ]);
    expect(out[0].content).toEqual([
      { type: "text", text: "look at this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } }
    ]);
  });

  it("converts functionCall parts to assistant tool_calls with queued ids", () => {
    const out = toOpenAIMessages([
      { role: "model", parts: [
        { functionCall: { name: "search_material", args: { q: "x" } } },
        { functionCall: { name: "translate_text", args: { text: "y", targetLanguage: "ms" } } }
      ] }
    ]);
    expect(out[0].role).toBe("assistant");
    expect(out[0].content).toBeNull();
    expect(out[0].tool_calls).toHaveLength(2);
    expect(out[0].tool_calls[0].id).toBe("call_0");
    expect(out[0].tool_calls[0].function).toEqual({ name: "search_material", arguments: '{"q":"x"}' });
    expect(out[0].tool_calls[1].id).toBe("call_1");
    expect(out[0].tool_calls[1].function.name).toBe("translate_text");
  });

  it("converts functionResponse parts to tool messages reusing queued ids in order", () => {
    const out = toOpenAIMessages([
      { role: "model", parts: [{ functionCall: { name: "search_material", args: {} } }] },
      { role: "user", parts: [{ functionResponse: { name: "search_material", response: { ok: true, result: "chunk text" } } }] }
    ]);
    expect(out[1]).toEqual({
      role: "tool",
      tool_call_id: "call_0",
      content: JSON.stringify({ ok: true, result: "chunk text" })
    });
  });

  it("maps role model -> assistant", () => {
    const out = toOpenAIMessages([{ role: "model", parts: [{ text: "hi" }] }]);
    expect(out[0].role).toBe("assistant");
  });
});

describe("parseOpenAIChat", () => {
  it("extracts text and usage", () => {
    const out = parseOpenAIChat({
      choices: [{ message: { content: "the answer" } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    }, "google/gemma-4-31b-it:free");
    expect(out.text).toBe("the answer");
    expect(out.functionCalls).toEqual([]);
    expect(out.usage).toEqual({ model: "google/gemma-4-31b-it:free", inputTokens: 10, outputTokens: 20 });
  });

  it("extracts tool_calls with JSON-parsed args", () => {
    const out = parseOpenAIChat({
      choices: [{ message: {
        content: null,
        tool_calls: [
          { id: "call_9", type: "function", function: { name: "generate_quiz", arguments: '{"topic":"physics"}' } }
        ]
      } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 }
    }, "openrouter/free");
    expect(out.text).toBe("");
    expect(out.functionCalls).toEqual([{ name: "generate_quiz", args: { topic: "physics" } }]);
  });

  it("defaults args to {} when arguments is not valid JSON", () => {
    const out = parseOpenAIChat({
      choices: [{ message: { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "t", arguments: "not-json" } }] } }],
      usage: {}
    }, "m");
    expect(out.functionCalls[0].args).toEqual({});
  });
});

describe("parseSSEChunk", () => {
  it("parses a data: JSON line", () => {
    const out = parseSSEChunk('data: {"choices":[{"delta":{"content":"hi"}}]}');
    expect(out.choices[0].delta.content).toBe("hi");
  });

  it("returns null for [DONE]", () => {
    expect(parseSSEChunk("data: [DONE]")).toBeNull();
  });

  it("returns null for non-data lines and garbage", () => {
    expect(parseSSEChunk(": keep-alive")).toBeNull();
    expect(parseSSEChunk("data: {broken")).toBeNull();
  });
});

describe("classifyRoute", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function mockClassifierReply(text: string) {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 5, completion_tokens: 2 } })
    }));
  }

  it("returns chat when the classifier replies CHAT", async () => {
    mockClassifierReply("CHAT");
    await expect(llm.classifyRoute("hi")).resolves.toBe("chat");
  });

  it("returns tool when the classifier replies TOOL", async () => {
    mockClassifierReply("TOOL");
    await expect(llm.classifyRoute("make me flashcards on physics")).resolves.toBe("tool");
  });

  it("defaults to tool on ambiguity or failure", async () => {
    mockClassifierReply("MAYBE");
    await expect(llm.classifyRoute("something weird")).resolves.toBe("tool");

    vi.unstubAllEnvs();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(llm.classifyRoute("hi")).resolves.toBe("tool");
  });
});

describe("parseJsonRepair", () => {
  it("parses plain JSON", () => {
    expect(parseJsonRepair('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json code fences before parsing", () => {
    expect(parseJsonRepair('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("generateContentStreamWithTools", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("merges fragmented tool_call arguments across SSE deltas per index", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const sse = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"search_material","arguments":"{\\"q\\":\\"thermo"}}]}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"dynamics\\"}"}}]}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_2","function":{"name":"translate_text","arguments":"{\\"text\\":\\"hi\\","}}]}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"arguments":"\\"targetLanguage\\":\\"ms\\"}"}}]}}]}\n',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}\n',
      'data: [DONE]\n'
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller: any) {
          const enc = new TextEncoder();
          for (const line of sse) {
            controller.enqueue(enc.encode(line));
          }
          controller.close();
        }
      }),
      json: async () => ({})
    }));

    const events: any[] = [];
    for await (const ev of llm.generateContentStreamWithTools([{ role: "user", parts: [{ text: "hi" }] }], {
      tools: [],
      task: "test"
    })) {
      events.push(ev);
    }

    const toolEvt = events.find((e) => e.type === "tool_calls");
    expect(toolEvt.calls).toHaveLength(2);
    expect(toolEvt.calls[0]).toEqual({ name: "search_material", args: { q: "thermodynamics" } });
    expect(toolEvt.calls[1]).toEqual({ name: "translate_text", args: { text: "hi", targetLanguage: "ms" } });
    expect(toolEvt.usage).toEqual({ model: "google/gemini-3.6-flash:nitro", inputTokens: 10, outputTokens: 5 });
    expect(events[events.length - 1].type).toBe("end");
  });
});
