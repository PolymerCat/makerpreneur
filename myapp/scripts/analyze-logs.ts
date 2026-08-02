import * as fs from "node:fs";
import * as path from "node:path";
import { estimateCostUs } from "../app/study/_lib/ai/logger";

type LogEntry = {
  requestId?: string;
  userId?: string;
  task?: string;
  model?: string;
  promptVersion?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUs?: number;
  toolCalls?: { tool: string; ok: boolean; durationMs: number }[];
  retrievedChunkIds?: string[];
  createdAt?: string;
  // Standalone tool log fields
  type?: string;
  tool?: string;
  ok?: boolean;
  durationMs?: number;
};

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    Math.floor((percentile / 100) * sorted.length),
    sorted.length - 1
  );
  return sorted[index];
}

async function loadLogsFromFile(): Promise<LogEntry[]> {
  const logPath = path.join(process.cwd(), "logs", "llm.jsonl");

  if (!fs.existsSync(logPath)) {
    console.log(`[INFO] No log file found at: ${logPath}`);
    return [];
  }

  const fileContent = fs.readFileSync(logPath, "utf-8");
  const lines = fileContent.split("\n").filter((l) => l.trim().length > 0);
  const entries: LogEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch (_err) {
      /* ignore invalid JSON lines */
    }
  }

  return entries;
}

async function analyzeLogs() {
  console.log(`\n==================================================`);
  console.log(`         LLM Log Analyzer`);
  console.log(`==================================================\n`);

  const entries = await loadLogsFromFile();

  // Filter entries into LLM call records vs Standalone tool records
  const llmCalls = entries.filter(
    (e) => e.task || e.model || e.inputTokens !== undefined || e.latencyMs !== undefined
  );
  const standaloneToolCalls = entries.filter((e) => e.type === "tool" && e.tool);

  if (llmCalls.length === 0 && standaloneToolCalls.length === 0) {
    console.log("No log records available for analysis.");
    return;
  }

  let totalCostUs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allLatencies: number[] = [];
  const taskLatencies: Record<string, number[]> = {};

  // Task / Model breakdown statistics
  const taskBreakdown: Record<
    string,
    { calls: number; inTokens: number; outTokens: number; cost: number }
  > = {};

  // Tool calls statistics aggregation
  const toolStats: Record<
    string,
    { calls: number; okCount: number; totalDurationMs: number }
  > = {};

  for (const call of llmCalls) {
    const task = call.task || "unknown_task";
    const model = call.model || "gemini-3.6-flash";
    const inTok = call.inputTokens || 0;
    const outTok = call.outputTokens || 0;
    const cost = call.costUs ?? estimateCostUs(model, inTok, outTok);

    totalInputTokens += inTok;
    totalOutputTokens += outTok;
    totalCostUs += cost;

    if (call.latencyMs !== undefined && call.latencyMs !== null) {
      allLatencies.push(call.latencyMs);
      if (!taskLatencies[task]) taskLatencies[task] = [];
      taskLatencies[task].push(call.latencyMs);
    }

    if (!taskBreakdown[task]) {
      taskBreakdown[task] = { calls: 0, inTokens: 0, outTokens: 0, cost: 0 };
    }
    taskBreakdown[task].calls += 1;
    taskBreakdown[task].inTokens += inTok;
    taskBreakdown[task].outTokens += outTok;
    taskBreakdown[task].cost += cost;

    // Process inline tool calls inside LLM entry if present
    if (Array.isArray(call.toolCalls)) {
      for (const tc of call.toolCalls) {
        const toolName = tc.tool;
        if (!toolStats[toolName]) {
          toolStats[toolName] = { calls: 0, okCount: 0, totalDurationMs: 0 };
        }
        toolStats[toolName].calls += 1;
        if (tc.ok) toolStats[toolName].okCount += 1;
        toolStats[toolName].totalDurationMs += tc.durationMs || 0;
      }
    }
  }

  // Process standalone tool log events
  for (const st of standaloneToolCalls) {
    const toolName = st.tool!;
    if (!toolStats[toolName]) {
      toolStats[toolName] = { calls: 0, okCount: 0, totalDurationMs: 0 };
    }
    toolStats[toolName].calls += 1;
    if (st.ok) toolStats[toolName].okCount += 1;
    toolStats[toolName].totalDurationMs += st.durationMs || 0;
  }

  const overallAvgLatency =
    allLatencies.length > 0
      ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
      : 0;
  const overallP95Latency = calculatePercentile(allLatencies, 95);

  // 1. Summary Metrics
  console.log("--- SUMMARY METRICS ---");
  console.log(`Total LLM Calls     : ${llmCalls.length}`);
  console.log(`Total Input Tokens  : ${totalInputTokens.toLocaleString()}`);
  console.log(`Total Output Tokens : ${totalOutputTokens.toLocaleString()}`);
  console.log(`Total Tokens        : ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`Total Cost (USD)    : $${totalCostUs.toFixed(6)}`);

  // 2. Latency Statistics
  console.log("\n--- LATENCY STATISTICS ---");
  console.log(`Overall Average Latency : ${overallAvgLatency} ms`);
  console.log(`Overall P95 Latency     : ${overallP95Latency} ms`);

  if (Object.keys(taskLatencies).length > 0) {
    console.log("\nLatency Breakdown by Task:");
    for (const [task, latencies] of Object.entries(taskLatencies)) {
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const p95 = calculatePercentile(latencies, 95);
      console.log(`  • ${task.padEnd(20)} : Avg = ${String(avg).padStart(5)} ms | P95 = ${String(p95).padStart(5)} ms (${latencies.length} calls)`);
    }
  }

  // 3. Tool Call Distribution
  console.log("\n--- TOOL CALL DISTRIBUTION ---");
  const toolEntries = Object.entries(toolStats);
  if (toolEntries.length === 0) {
    console.log("No tool calls recorded.");
  } else {
    for (const [tool, stats] of toolEntries) {
      const rate = ((stats.okCount / stats.calls) * 100).toFixed(1);
      const avgDur = Math.round(stats.totalDurationMs / stats.calls);
      console.log(
        `  • ${tool.padEnd(22)} : ${String(stats.calls).padStart(4)} calls | ${rate.padStart(5)}% success | Avg Duration: ${avgDur} ms`
      );
    }
  }

  // 4. Token Usage & Cost Breakdown
  console.log("\n--- TOKEN USAGE & COST BREAKDOWN ---");
  const taskEntries = Object.entries(taskBreakdown);
  if (taskEntries.length === 0) {
    console.log("No token usage recorded.");
  } else {
    for (const [task, info] of taskEntries) {
      console.log(`  • ${task.padEnd(20)} : ${info.calls} calls`);
      console.log(`      Input Tokens  : ${info.inTokens.toLocaleString()}`);
      console.log(`      Output Tokens : ${info.outTokens.toLocaleString()}`);
      console.log(`      Total Tokens  : ${(info.inTokens + info.outTokens).toLocaleString()}`);
      console.log(`      Subtotal Cost : $${info.cost.toFixed(6)}`);
    }
  }

  console.log("\n==================================================\n");
}

analyzeLogs().catch((err) => {
  console.error("Fatal error during log analysis:", err);
  process.exit(1);
});
