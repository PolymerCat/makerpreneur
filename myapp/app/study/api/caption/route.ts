import { llm } from "../../_lib/ai/gemini";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { downloadImageParts } from "../../_lib/chat-images";

// ponytail: single provider-chain attempt; failure degrades to default
// caption, never blocks the chat stream (called fire-and-forget from client).
export async function POST(request: Request) {
  try {
    var body = await request.json();
    var paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    if (paths.length === 0) {
      return Response.json({ captions: paths.map(function() { return "User uploaded image"; }) });
    }

    var supabase = await createServerSupabaseClient();
    var imageParts = await downloadImageParts(supabase, paths);

    var text = await llm.generateFromImages(
      imageParts,
      "Describe each of the " + paths.length + " images in one short sentence (max 15 words). Output ONLY the descriptions, one per line, in the same order as the images. No numbering or labels.",
      "caption"
    );
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
