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
 * Get MIME type for audio files
 */
const getAudioMimeType = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'wav': return 'audio/wav';
    case 'mp3': return 'audio/mpeg';
    case 'ogg': return 'audio/ogg';
    case 'flac': return 'audio/flac';
    case 'm4a': return 'audio/mp4';
    case 'aac': return 'audio/aac';
    default: return 'audio/mpeg';
  }
};

/**
 * Escape HTML characters in text
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Post-process HTML to handle image attributes like {width=400} and audio media
 */
const processImageAttributes = (html: string): string => {
  // Match img tags followed by {attribute=value} patterns
  const imgAttributeRegex = /<img([^>]+)>\{([^}]+)\}/g;
  
  return html.replace(imgAttributeRegex, (match, imgAttributes, attributes) => {
    // Parse the attributes from {width=400} format
    const attrPairs = attributes.split(',').map((attr: string) => attr.trim());
    const styleAttributes: string[] = [];
    const htmlAttributes: string[] = [];
    let isAudio = false;
    
    // Check if this should be converted to audio
    for (const pair of attrPairs) {
      const [key, value] = pair.split('=').map((s: string) => s.trim());
      if (key === 'media' && value === 'audio') {
        isAudio = true;
        break;
      }
    }
    
    // If it's audio, convert img tag to audio element
    if (isAudio) {
      // Extract src from img attributes
      const srcMatch = imgAttributes.match(/src="([^"]+)"/);
      if (srcMatch) {
        const audioSrc = srcMatch[1];
        const mimeType = getAudioMimeType(audioSrc);
        
        // Extract alt text for audio description
        const altMatch = imgAttributes.match(/alt="([^"]+)"/);
        const altText = altMatch ? escapeHtml(altMatch[1]) : 'Audio file';
        
        return `<audio controls>
  <source src="${audioSrc}" type="${mimeType}">
  Your browser does not support the audio element.
</audio>
<p class="audio-caption">${altText}</p>`;
      }
      // Fallback if no src found
      return match;
    }
    
    // Handle regular image attributes
    for (const pair of attrPairs) {
      const [key, value] = pair.split('=').map((s: string) => s.trim());
      if (key && value && key !== 'media') {
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

/**
 * Clean up HTML to fix nested paragraph issues with audio elements
 */
const cleanupAudioHTML = (html: string): string => {
  // Fix cases where audio + caption are wrapped in <p> tags
  return html.replace(
    /<p>(<audio[^>]*>[\s\S]*?<\/audio>\s*<p class="audio-caption">[^<]*<\/p>)<\/p>/g,
    '$1'
  );
};

export const markdownToHtml = (markdown: string): Result<string, AppError> => {
  try {
    // Parse markdown to HTML
    let html = marked.parse(markdown) as string;
    
    // Post-process to handle image attributes
    html = processImageAttributes(html);
    
    // Clean up any nested paragraph issues with audio elements
    html = cleanupAudioHTML(html);

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
