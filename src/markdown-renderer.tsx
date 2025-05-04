/**
 * Custom markdown renderer that integrates with mono-jsx
 * This provides a bridge between markdown content and JSX rendering
 */

import { marked } from "https://esm.sh/marked@15.0.11";
import { Result } from "./types.ts";
import { createError } from "./error.ts";
import { htmlToJsx } from "./utils/html-to-jsx.tsx";

// In-memory cache for better performance
const markdownCache = new Map<string, string>();

/**
 * Convert markdown to HTML
 * This uses the marked library and caches results
 */
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
 * Convert markdown directly to JSX elements
 * This is a two-step process: markdown → HTML → JSX
 */
export const markdownToJsxElements = (
  markdown: string,
): Result<JSX.Element, AppError> => {
  // Step 1: Convert markdown to HTML
  const htmlResult = markdownToHtml(markdown);
  
  if (!htmlResult.ok) {
    return htmlResult;
  }
  
  try {
    // Step 2: Convert HTML to JSX elements
    const jsxElements = htmlToJsx(htmlResult.value);
    
    return {
      ok: true,
      value: jsxElements,
    };
  } catch (error) {
    return {
      ok: false,
      error: createError(
        "RenderError",
        "Failed to convert HTML to JSX elements",
        error,
      ),
    };
  }
};

// Application-specific error type
type AppError = import("./error.ts").AppError;