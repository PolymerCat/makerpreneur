import type { SupabaseClient } from "@supabase/supabase-js";

export type GeminiImagePart = { inlineData: { mimeType: string; data: string } };

export function mimeFromPath(path: string): string {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "image/jpeg";
}

export async function downloadImageParts(supabase: SupabaseClient, paths: string[]): Promise<GeminiImagePart[]> {
  return Promise.all(paths.map(async function(path) {
    var { data, error } = await supabase.storage.from("materials").download(path);
    if (error || !data) {
      throw new Error("Image download failed: " + (error?.message || path));
    }
    var buf = Buffer.from(await data.arrayBuffer());
    return { inlineData: { mimeType: mimeFromPath(path), data: buf.toString("base64") } };
  }));
}
