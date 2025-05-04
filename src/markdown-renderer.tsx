import { marked } from "https://esm.sh/marked@15.0.11";
import { Result } from "./types.ts";
import { createError } from "./error.ts";

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

/**
 * Stub function to maintain compatibility with existing code
 * This function is no longer used for JSX rendering
 */
export const markdownToJsxElements = (
  markdown: string,
): Result<any, AppError> => {
  // Just return the HTML as a string
  return markdownToHtml(markdown);
};

// Application-specific error type
type AppError = import("./error.ts").AppError;
