import { marked } from "https://esm.sh/marked@15.0.12";
import { markedHighlight } from "https://esm.sh/marked-highlight@2.1.4";
import hljs from "https://esm.sh/highlight.js@11.10.0";
import { Result } from "./types.ts";
import { createError } from "./error.ts";

// Configure marked with syntax highlighting
marked.use(markedHighlight({
  langPrefix: "hljs language-",
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.warn(
          `Failed to highlight code block with language "${lang}":`,
          err,
        );
      }
    }

    // Fallback to auto-detection
    try {
      return hljs.highlightAuto(code).value;
    } catch (err) {
      console.warn("Failed to auto-highlight code block:", err);
      return code; // Return original code if highlighting fails
    }
  },
}));

// In-memory cache for better performance
const markdownCache = new Map<string, string>();

export const markdownToHtml = (markdown: string): Result<string, AppError> => {
  try {
    // Check cache first
    if (markdownCache.has(markdown)) {
      return { ok: true, value: markdownCache.get(markdown)! };
    }

    // Parse markdown if not in cache
    const html = marked.parse(markdown) as string;

    // Cache the result
    markdownCache.set(markdown, html);

    return { ok: true, value: html };
  } catch (error) {
    return {
      ok: false,
      error: createError(
        "ParseError",
        "Failed to parse markdown",
        error,
      ),
    };
  }
};

// Application-specific error type
type AppError = import("./error.ts").AppError;
