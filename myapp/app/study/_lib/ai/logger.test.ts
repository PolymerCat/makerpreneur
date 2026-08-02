import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { estimateCostUs, logLlmCall, logToolCall, LlmLogEntry } from "./logger";

describe("Structured Logger & Cost Estimator", () => {
  const logDir = path.join(process.cwd(), "logs");
  const logFilePath = path.join(logDir, "llm.jsonl");

  beforeEach(() => {
    // Clean up test log file before each test
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }
  });

  it("calculates accurate Gemini pricing for known and fallback models", () => {
    // gemini-3.6-flash: in=0.15/1M, out=0.6/1M
    const costFlash = estimateCostUs("gemini-3.6-flash", 1_000_000, 2_000_000);
    expect(costFlash).toBeCloseTo(0.15 + 1.20, 6);

    // gemini-2.5-pro: in=1.25/1M, out=10/1M
    const costPro = estimateCostUs("gemini-2.5-pro", 1_000_000, 1_000_000);
    expect(costPro).toBeCloseTo(1.25 + 10.0, 6);

    // gemini-3.5-flash-lite: in=0.075/1M, out=0.3/1M
    const costLite = estimateCostUs("gemini-3.5-flash-lite", 500_000, 1_000_000);
    expect(costLite).toBeCloseTo(0.0375 + 0.3, 6);

    // Default fallback: in=0.3/1M, out=1.2/1M
    const costDefault = estimateCostUs("unknown-model-xyz", 1_000_000, 1_000_000);
    expect(costDefault).toBeCloseTo(0.3 + 1.2, 6);
  });

  it("logs LLM call to dev mode llm.jsonl and computes missing costUs", async () => {
    const entry: LlmLogEntry = {
      requestId: "test-req-123",
      task: "agent_chat",
      model: "gemini-3.6-flash",
      latencyMs: 350,
      inputTokens: 1000,
      outputTokens: 500,
      toolCalls: [{ tool: "search_material", ok: true, durationMs: 120 }],
      createdAt: new Date().toISOString(),
    };

    logLlmCall(entry, "user-456");

    // Wait briefly for asynchronous execution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fs.existsSync(logFilePath)).toBe(true);
    const content = fs.readFileSync(logFilePath, "utf-8").trim();
    const lines = content.split("\n");
    expect(lines.length).toBe(1);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.requestId).toBe("test-req-123");
    expect(parsed.userId).toBe("user-456");
    expect(parsed.task).toBe("agent_chat");
    expect(parsed.latencyMs).toBe(350);
    expect(parsed.costUs).toBeGreaterThan(0);
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0].tool).toBe("search_material");
  });

  it("logs standalone tool calls to llm.jsonl", async () => {
    logToolCall("req-tool-789", "generate_quiz", true, 240);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fs.existsSync(logFilePath)).toBe(true);
    const content = fs.readFileSync(logFilePath, "utf-8").trim();
    const parsed = JSON.parse(content);

    expect(parsed.requestId).toBe("req-tool-789");
    expect(parsed.type).toBe("tool");
    expect(parsed.tool).toBe("generate_quiz");
    expect(parsed.ok).toBe(true);
    expect(parsed.durationMs).toBe(240);
  });
});
