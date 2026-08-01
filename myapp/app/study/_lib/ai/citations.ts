export function stripCitations(text: string): string {
  return text.replace(/\[\s*\d+(?:\s*[,;–\-–]\s*\d+)*\s*\]/g, "");
}
