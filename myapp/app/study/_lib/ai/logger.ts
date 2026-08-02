import { sdb } from "../supabase-db";
import * as fs from "node:fs";
import * as path from "node:path";
import { after } from "next/server";

export type LlmLogEntry = {
  id?: string;
  userId?: string;
  requestId: string;
  task: string;
  model: string;
  promptVersion?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costUs?: number;
  toolCalls?: { tool: string; ok: boolean; durationMs: number }[];
  retrievedChunkIds?: string[];
  createdAt?: string;
};

const MODEL_RATES: Record<string, { in: number; out: number }> = {
  "gemini-3.6-flash": { in: 0.15, out: 0.6 },   // USD per 1M tokens
  "gemini-3.5-flash": { in: 0.3, out: 1.2 },
  "gemini-3.5-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-3.1-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-2.5-pro":   { in: 1.25, out: 10.0 },
  "gemini-2.5-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-2.5-flash": { in: 0.15, out: 0.6 },
  default:            { in: 0.3, out: 1.2 },
};

export function estimateCostUs(model: string, inTok: number = 0, outTok: number = 0): number {
  const r = MODEL_RATES[model] ?? MODEL_RATES.default;
  return (inTok / 1_000_000) * r.in + (outTok / 1_000_000) * r.out;
}

const LOG_PATH = path.join(process.cwd(), "logs", "llm.jsonl");

export function logLlmCall(entry: LlmLogEntry, userId?: string): void {
  const uid = userId || entry.userId;
  const inTok = entry.inputTokens ?? 0;
  const outTok = entry.outputTokens ?? 0;
  const calculatedCost = entry.costUs ?? estimateCostUs(entry.model, inTok, outTok);

  const fullEntry: LlmLogEntry = {
    ...entry,
    userId: uid,
    costUs: calculatedCost,
    createdAt: entry.createdAt || new Date().toISOString(),
  };

  const doLog = async () => {
    try {
      if (process.env.NODE_ENV === "production") {
        if (uid) {
          await supabaseLog(uid, fullEntry);
        }
      } else {
        const logDir = path.dirname(LOG_PATH);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        fs.appendFileSync(LOG_PATH, JSON.stringify(fullEntry) + "\n");
      }
    } catch (_err) {
      /* logging must never break chat */
    }
  };

  try {
    after(doLog);
  } catch (_afterErr) {
    // Fallback if after() is invoked outside Next.js request context (e.g. CLI or unit tests)
    void doLog();
  }
}

export function logToolCall(requestId: string, tool: string, ok: boolean, durationMs: number): void {
  const doLog = () => {
    try {
      const logDir = path.dirname(LOG_PATH);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(
        LOG_PATH,
        JSON.stringify({ requestId, type: "tool", tool, ok, durationMs, createdAt: new Date().toISOString() }) + "\n"
      );
    } catch (_err) { /* no-op */ }
  };

  try {
    after(doLog);
  } catch (_afterErr) {
    doLog();
  }
}

async function supabaseLog(userId: string, entry: LlmLogEntry): Promise<void> {
  try {
    const supabase = await sdb.getClient();
    await supabase.from("llm_logs").insert({
      user_id: userId,
      request_id: entry.requestId,
      task: entry.task,
      model: entry.model,
      prompt_version: entry.promptVersion,
      latency_ms: entry.latencyMs,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_us: entry.costUs,
      tool_calls: entry.toolCalls,
      retrieved_chunk_ids: entry.retrievedChunkIds,
    });
  } catch (_err) {
    /* no-op */
  }
}
