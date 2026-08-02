import { describe, it, expect } from "vitest";
import { toOpenAITools, toOpenAIMessages, parseOpenAIChat, parseSSEChunk, parseJsonRepair } from "./gemini";

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
      function: { name: "search_material", description: "Search materials", parameters: { type: "OBJECT", properties: { q: { type: "STRING" } } } }
    });
    expect(out[1].function.name).toBe("generate_flashcards");
  });

  it("returns [] for falsy input", () => {
    expect(toOpenAITools(undefined as any)).toEqual([]);
    expect(toOpenAITools([])).toEqual([]);
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

describe("parseJsonRepair", () => {
  it("parses plain JSON", () => {
    expect(parseJsonRepair('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json code fences before parsing", () => {
    expect(parseJsonRepair('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
