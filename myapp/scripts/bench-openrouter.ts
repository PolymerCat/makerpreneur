// Benchmarks the OpenRouter slots in TEXT_SLOTS order. Run: npx tsx scripts/bench-openrouter.ts
import * as fs from "node:fs";
import * as path from "node:path";

const SLOTS = [
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openai/gpt-oss-20b:free",
  "google/gemini-3.5-flash",
  "google/gemini-3.6-flash",
];

const PROMPT =
  "Write a short paragraph (about 100 words) explaining why the sky is blue, aimed at a high school student.";

function loadApiKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const content = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const m = content.match(/^OPENROUTER_API_KEY=(.+)$/m);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

async function bench(model: string, key: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://study-hub.local",
        "X-Title": "Makerpreneur Study Hub",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROMPT }],
        max_tokens: 200,
      }),
    });
    const data: any = await res.json();
    const elapsed = (Date.now() - start) / 1000;
    const out = data.usage?.completion_tokens || 0;
    const tps = out > 0 ? Math.round(out / elapsed) : "-";
    console.log(
      model.padEnd(48) +
        elapsed.toFixed(1).padStart(7) +
        "s  ~" +
        String(tps).padStart(5) +
        " tok/s" +
        (res.ok ? "" : "  HTTP " + res.status + " " + (data.error?.message || ""))
    );
  } catch (e: any) {
    console.log(model.padEnd(48) + "ERROR " + (e?.message || e));
  }
}

async function main(): Promise<void> {
  const key = loadApiKey();
  if (!key) {
    console.error("OPENROUTER_API_KEY not found in env or .env");
    process.exit(1);
  }
  console.log("Benchmarking " + SLOTS.length + " slots (sequential, max_tokens=200):\n");
  for (const model of SLOTS) {
    await bench(model, key);
  }
}

main();
