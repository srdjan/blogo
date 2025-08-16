/**
 * Calculate estimated reading time for content
 * Based on average reading speed of 200-250 words per minute
 */

export type ReadingTimeResult = {
  readonly minutes: number;
  readonly words: number;
  readonly text: string;
};

const WORDS_PER_MINUTE = 225; // Average reading speed

/**
 * Extract text content from markdown, removing frontmatter and formatting
 */
function extractTextFromMarkdown(markdown: string): string {
  // Remove frontmatter
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n/, '');
  
  // Remove code blocks
  const withoutCodeBlocks = withoutFrontmatter.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, '');
  
  // Remove markdown formatting
  const withoutFormatting = withoutInlineCode
    .replace(/!\[.*?\]\(.*?\)/g, '') // Images
    .replace(/\[.*?\]\(.*?\)/g, '') // Links
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/[*_]{1,2}(.*?)[*_]{1,2}/g, '$1') // Bold/italic
    .replace(/~~(.*?)~~/g, '$1') // Strikethrough
    .replace(/^\s*[-*+]\s/gm, '') // List items
    .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
    .replace(/^\s*>\s/gm, '') // Blockquotes
    .replace(/\n{2,}/g, ' ') // Multiple newlines
    .replace(/\s+/g, ' ') // Multiple spaces
    .trim();
  
  return withoutFormatting;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate reading time for markdown content
 */
export function calculateReadingTime(markdown: string): ReadingTimeResult {
  const text = extractTextFromMarkdown(markdown);
  const words = countWords(text);
  const minutes = Math.ceil(words / WORDS_PER_MINUTE);
  
  return {
    minutes,
    words,
    text: `${minutes} min read`
  };
}

/**
 * Generate reading time meta tag content
 */
export function getReadingTimeMeta(readingTime: ReadingTimeResult): string {
  return `PT${readingTime.minutes}M`;
}