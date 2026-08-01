import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { llm } from "../../_lib/ai/gemini";

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

    // Suppress standard font warnings (not needed in server-side Node context)
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    var doc = await pdfjsLib.getDocument({
      data: fileBuffer,
      verbosity: 0,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;
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

    // Fallback to Gemini Multimodal Vision API if PDF is scanned (0 text extracted)
    if (pages.length === 0) {
      console.log("[EXTRACT] No embedded text found by pdfjs-dist. Falling back to Gemini Vision OCR...");
      try {
        var ocrPrompt = "You are an expert document OCR transcriber. Transcribe this scanned PDF document page by page into clear Markdown text. Include page markers like '--- Page X ---' before each page's content. Transcribe all text, tables, diagrams, and handwriting accurately without skipping any details.";
        var transcribedText = await llm.generateFromDocument(fileBuffer, ocrPrompt, "application/pdf", "scannedPdfOcr");
        
        if (transcribedText && transcribedText.trim().length > 0) {
          fullText = transcribedText.trim();
          var pageBlocks = fullText.split(/--- Page \d+ ---/i).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
          if (pageBlocks.length > 0) {
            pages = pageBlocks.map(function(block, idx) {
              return { page: idx + 1, text: block };
            });
            numPages = pages.length;
          } else {
            pages = [{ page: 1, text: fullText }];
            numPages = 1;
          }
        }
      } catch (ocrError) {
        console.error("[EXTRACT] Gemini Vision OCR fallback failed:", ocrError);
      }
    }

    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: "No text could be extracted from PDF (even with AI Vision)." }), {
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
