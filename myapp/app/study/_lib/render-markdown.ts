import { marked } from "marked";
import katex from "katex";

export function renderMarkdown(text: string, breaks?: boolean): string {
  // Display math $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_: string, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: true });
    } catch {
      return `<code class="chat-latex-fallback">$${formula}$$</code>`;
    }
  });

  // Inline math $...$
  text = text.replace(/\$(.+?)\$/g, (_: string, formula: string) => {
    if (!/[a-zA-Z\\]/.test(formula)) return _;
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: true });
    } catch {
      return _;
    }
  });

  return marked.parse(text, { breaks: !!breaks }) as string;
}
