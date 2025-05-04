import { Post, PostMeta, Result } from "./types.ts";
import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import { chain, createError, tryCatch } from "./error.ts";
import { CONFIG } from "./config.ts";
import { logger, formatDate } from "./utils.ts";
import { markdownToHtml, markdownToJsxElements } from "./markdown-renderer.tsx";

/**
 * Extract frontmatter and content from markdown text
 */
const extractFrontmatter = (
  text: string,
): Result<{ frontmatter: string; content: string }, AppError> => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    return {
      ok: false,
      error: createError(
        "ParseError",
        "Invalid frontmatter format",
      ),
    };
  }

  return {
    ok: true,
    value: {
      frontmatter: match[1],
      content: match[2],
    },
  };
};

/**
 * Parse YAML frontmatter into post metadata
 */
const parseFrontmatter = (
  frontmatter: string,
  slug: string,
): Result<PostMeta, AppError> => {
  try {
    const meta = parseYaml(frontmatter) as PostMeta;

    // Validation: required fields
    if (!meta.title) {
      return {
        ok: false,
        error: createError(
          "ValidationError",
          "Post title is required in frontmatter",
        ),
      };
    }

    if (!meta.date) {
      return {
        ok: false,
        error: createError(
          "ValidationError",
          "Post date is required in frontmatter",
        ),
      };
    }

    // Ensure slug is set
    meta.slug = meta.slug || slug;

    return { ok: true, value: meta };
  } catch (error) {
    return {
      ok: false,
      error: createError(
        "ParseError",
        "Failed to parse frontmatter YAML",
        error,
      ),
    };
  }
};

/**
 * Parse a markdown file into a Post object
 * This version supports both HTML string and JSX element rendering
 */
export const parseMarkdown = async (
  filePath: string,
  slug: string,
): Promise<Result<Post, AppError>> => {
  const readFile = await tryCatch<string, AppError>(
    async () => await Deno.readTextFile(filePath),
    (error) =>
      createError("IOError", `Failed to read file: ${filePath}`, error),
  );

  return chain(readFile, (text) => {
    // Extract frontmatter and content
    const extracted = extractFrontmatter(text);
    if (!extracted.ok) return extracted;

    // Parse frontmatter to metadata
    const meta = parseFrontmatter(extracted.value.frontmatter, slug);
    if (!meta.ok) return meta;

    // Parse markdown to HTML for backward compatibility
    const html = markdownToHtml(extracted.value.content);
    if (!html.ok) return html;

    // Parse markdown to JSX elements for mono-jsx rendering
    const jsxContent = markdownToJsxElements(extracted.value.content);
    if (!jsxContent.ok) {
      logger.warn(`Failed to convert markdown to JSX for post: ${slug}`);
      // We'll continue with HTML content if JSX conversion fails
    }

    // Combine metadata and content into a Post
    const formattedDate = formatDate(meta.value.date);

    return {
      ok: true,
      value: {
        ...meta.value,
        content: html.value, // Keep HTML string for backward compatibility
        contentJsx: jsxContent.ok ? jsxContent.value : undefined, // Add JSX content if available
        formattedDate,
      },
    };
  });
};

/**
 * Type guard for Post objects
 * Currently not used but kept for potential future use
 */
const _isPost = (obj: unknown): obj is Post => {
  return obj !== null &&
    typeof obj === "object" &&
    "title" in obj &&
    "date" in obj &&
    "slug" in obj &&
    "content" in obj;
};

/**
 * Load all posts from the content directory
 */
export const loadPosts = async (): Promise<Result<Post[], AppError>> => {
  const postsDir = CONFIG.blog.postsDir;

  const readDir = await tryCatch<Deno.DirEntry[], AppError>(
    async () => {
      const entries: Deno.DirEntry[] = [];
      for await (const entry of Deno.readDir(postsDir)) {
        if (entry.isFile && entry.name.endsWith(".md")) {
          entries.push(entry);
        }
      }
      return entries;
    },
    (error) => createError("IOError", `Failed to read posts directory: ${postsDir}`, error),
  );

  if (!readDir.ok) return readDir;

  const postResults = await Promise.all(
    readDir.value.map(async (entry) => {
      const slug = entry.name.replace(/\.md$/, "");
      return await parseMarkdown(`${postsDir}/${entry.name}`, slug);
    }),
  );

  // Filter out failures and collect successful posts
  const posts: Post[] = [];
  const errors: AppError[] = [];

  for (const result of postResults) {
    if (result.ok) {
      posts.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  // Log errors and provide more context
  if (errors.length > 0) {
    logger.error(
      `Errors loading ${errors.length} out of ${postResults.length} posts:`,
    );
    errors.forEach((err) => {
      logger.error(`- ${err.kind}: ${err.message}`);
      if (err.cause) logger.error(`  Cause: ${err.cause}`);
    });

    // If all posts failed to load, return error
    if (posts.length === 0 && errors.length > 0) {
      return {
        ok: false,
        error: createError(
          "DataError",
          `Failed to load any posts. ${errors.length} post files had errors.`,
          errors[0], // Include the first error as the cause
        ),
      };
    }

    // Add retry mechanism for empty posts with a delay of 1 second
    if (posts.length === 0) {
      logger.info("No posts loaded successfully. Retrying once...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return loadPosts(); // Recursive retry (will only happen once due to checks)
    }
  }

  // Sort posts by date, newest first
  return {
    ok: true,
    value: posts.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
  };
};

// Application-specific error type
type AppError = import("./error.ts").AppError;
