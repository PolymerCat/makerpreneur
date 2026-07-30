import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

var BUCKET = "materials";

export async function POST(request: Request) {
  try {
    var body = await request.json();
    var storagePath = body.storagePath || "";

    if (storagePath === "") {
      return new Response(JSON.stringify({ error: "storagePath is required" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    var supabase = await createServerSupabaseClient();
    var { data: fileBlob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !fileBlob) {
      return new Response(JSON.stringify({ error: "Download failed: " + (downloadError?.message || "no file") }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    var arrayBuffer = await fileBlob.arrayBuffer();
    var fileBuffer = new Uint8Array(arrayBuffer);

    var doc = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
    var fullText = "";
    var pages: { page: number; text: string }[] = [];
    var numPages = doc.numPages;

    for (var i = 1; i <= numPages; i++) {
      var page = await doc.getPage(i);
      var content = await page.getTextContent();
      var text = "";
      for (var j = 0; j < content.items.length; j++) {
        var item = content.items[j];
        text = text + (item as any).str;
      }
      text = text.trim();
      if (text.length > 0) {
        pages.push({ page: i, text: text });
        fullText = fullText + text + "\n\n";
      }
    }

    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: "No text extracted from PDF" }), {
        status: 422,
        headers: { "content-type": "application/json" }
      });
    }

    var publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

    return new Response(JSON.stringify({
      pages: pages,
      text: fullText.trim(),
      numPages: numPages,
      storageUrl: publicUrl
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    console.error("extract route error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
