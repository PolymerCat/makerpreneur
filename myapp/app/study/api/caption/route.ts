import { GoogleGenAI } from "@google/genai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { downloadImageParts } from "../../_lib/chat-images";

var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

var CAPTION_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

// ponytail: single model attempt each; failure degrades to default caption,
// never blocks the chat stream (called fire-and-forget from the client).
export async function POST(request: Request) {
  try {
    var body = await request.json();
    var paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    if (paths.length === 0 || GEMINI_API_KEY === "") {
      return Response.json({ captions: paths.map(function() { return "User uploaded image"; }) });
    }

    var supabase = await createServerSupabaseClient();
    var imageParts = await downloadImageParts(supabase, paths);

    var client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    var result: any = null;
    for (var i = 0; i < CAPTION_MODELS.length && !result; i++) {
      try {
        result = await client.models.generateContent({
          model: CAPTION_MODELS[i],
          contents: [{
            role: "user",
            parts: [...imageParts, {
              text: "Describe each of the " + paths.length + " images in one short sentence (max 15 words). Output ONLY the descriptions, one per line, in the same order as the images. No numbering or labels."
            }]
          }],
          config: { temperature: 0.2, maxOutputTokens: 300 }
        });
      } catch (err) {
        console.error("[CAPTION] " + CAPTION_MODELS[i] + " failed:", err);
      }
    }

    var text: string = (result && result.text) || "";
    var lines = text.split("\n").map(function(l: string) { return l.trim(); }).filter(function(l: string) { return l !== ""; });
    var captions: string[] = [];
    for (var j = 0; j < paths.length; j++) {
      captions.push(lines[j] || "User uploaded image");
    }
    return Response.json({ captions: captions });
  } catch (err) {
    console.error("[CAPTION] route error:", err);
    return Response.json({ captions: [] });
  }
}
