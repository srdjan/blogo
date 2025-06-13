import { marked } from "https://esm.sh/marked@15.0.12";
import hljs from "https://esm.sh/highlight.js@11.10.0";
import { Result } from "./types.ts";
import { createError } from "./error.ts";
import { renderMermaidToSVG } from "./mermaid-ssr.ts";

// Custom renderer for mermaid blocks
const renderer = new marked.Renderer();

renderer.code = function (token) {
  // Handle the new marked API where token is an object
  const code = token.text;
  const lang = token.lang;

  if (lang === "mermaid") {
    return renderMermaidToSVG(code);
  }

  // For other code blocks, use highlighting
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(code, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    } catch (err) {
      console.warn(
        `Failed to highlight code block with language "${lang}":`,
        err,
      );
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    }
  }

  // Fallback for code without language - try auto-detection
  try {
    const highlighted = hljs.highlightAuto(code).value;
    return `<pre><code class="hljs">${highlighted}</code></pre>`;
  } catch (_err) {
    // Final fallback - plain code
    return `<pre><code>${code}</code></pre>`;
  }
};

// Configure marked with custom renderer
marked.use({ renderer });

export const markdownToHtml = (markdown: string): Result<string, AppError> => {
  try {
    // Parse markdown to HTML
    const html = marked.parse(markdown) as string;

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
