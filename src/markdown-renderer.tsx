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

/**
 * Post-process HTML to handle image attributes like {width=400}
 */
const processImageAttributes = (html: string): string => {
  // Match img tags followed by {attribute=value} patterns
  const imgAttributeRegex = /<img([^>]+)>\{([^}]+)\}/g;
  
  return html.replace(imgAttributeRegex, (match, imgAttributes, attributes) => {
    // Parse the attributes from {width=400} format
    const attrPairs = attributes.split(',').map((attr: string) => attr.trim());
    const styleAttributes: string[] = [];
    const htmlAttributes: string[] = [];
    
    for (const pair of attrPairs) {
      const [key, value] = pair.split('=').map((s: string) => s.trim());
      if (key && value) {
        if (key === 'width' || key === 'height') {
          // Add as CSS style and HTML attribute
          const cssValue = value.includes('px') || value.includes('%') ? value : `${value}px`;
          styleAttributes.push(`${key}: ${cssValue}`);
          htmlAttributes.push(`${key}="${value}"`);
        } else {
          // Add other attributes directly
          htmlAttributes.push(`${key}="${value}"`);
        }
      }
    }
    
    // Build the final img tag
    let finalImg = `<img${imgAttributes}`;
    
    // Add HTML attributes
    if (htmlAttributes.length > 0) {
      finalImg += ` ${htmlAttributes.join(' ')}`;
    }
    
    // Add style attribute if we have style properties
    if (styleAttributes.length > 0) {
      finalImg += ` style="${styleAttributes.join('; ')}"`;
    }
    
    finalImg += '>';
    
    return finalImg;
  });
};

export const markdownToHtml = (markdown: string): Result<string, AppError> => {
  try {
    // Parse markdown to HTML
    let html = marked.parse(markdown) as string;
    
    // Post-process to handle image attributes
    html = processImageAttributes(html);

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
