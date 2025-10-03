import type { AppResult } from "../lib/types.ts";
import { createError } from "../lib/error.ts";
import { err, ok } from "../lib/result.ts";

// Validation schema for post frontmatter
export type FrontmatterSchema = {
  readonly title: string;
  readonly date: string; // Always normalized to string format
  readonly slug?: string;
  readonly excerpt?: string;
  readonly tags?: readonly string[];
  readonly modified?: string;
  readonly draft?: boolean;
  readonly author?: string;
  readonly category?: string;
};

// Validation rules
const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 200;
const EXCERPT_MAX_LENGTH = 500;
const TAG_MAX_LENGTH = 50;
const MAX_TAGS = 10;

// Date validation regex (YYYY-MM-DD format)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Slug validation regex (lowercase letters, numbers, hyphens)
const SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * Validate frontmatter data against schema
 */
export function validateFrontmatter(
  data: unknown,
): AppResult<FrontmatterSchema> {
  if (!data || typeof data !== "object") {
    return err(createError(
      "ValidationError",
      "Frontmatter must be an object",
      undefined,
      { retryable: false },
    ));
  }

  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  // Validate required title
  if (!obj.title || typeof obj.title !== "string") {
    errors.push("Title is required and must be a string");
  } else if (
    obj.title.length < TITLE_MIN_LENGTH || obj.title.length > TITLE_MAX_LENGTH
  ) {
    errors.push(
      `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters`,
    );
  }

  // Validate required date (can be string or Date object from YAML parsing)
  if (!obj.date) {
    errors.push("Date is required");
  } else {
    let dateString: string;

    if (obj.date instanceof Date) {
      dateString = obj.date.toISOString().split("T")[0] ?? "";
    } else if (typeof obj.date === "string") {
      dateString = obj.date;
    } else {
      errors.push("Date must be a string or Date object");
      dateString = "";
    }

    if (dateString && !DATE_REGEX.test(dateString)) {
      errors.push("Date must be in YYYY-MM-DD format");
    } else if (dateString) {
      // Validate date is not in the future (unless draft)
      const postDate = new Date(dateString);
      const now = new Date();
      if (postDate > now && !obj.draft) {
        errors.push("Published posts cannot have future dates");
      }
    }
  }

  // Validate optional slug
  if (obj.slug !== undefined) {
    if (typeof obj.slug !== "string") {
      errors.push("Slug must be a string");
    } else if (!SLUG_REGEX.test(obj.slug)) {
      errors.push(
        "Slug must contain only lowercase letters, numbers, and hyphens",
      );
    }
  }

  // Validate optional excerpt
  if (obj.excerpt !== undefined) {
    if (typeof obj.excerpt !== "string") {
      errors.push("Excerpt must be a string");
    } else if (obj.excerpt.length > EXCERPT_MAX_LENGTH) {
      errors.push(
        `Excerpt must be no more than ${EXCERPT_MAX_LENGTH} characters`,
      );
    }
  }

  // Validate optional tags
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) {
      errors.push("Tags must be an array");
    } else {
      if (obj.tags.length > MAX_TAGS) {
        errors.push(`Cannot have more than ${MAX_TAGS} tags`);
      }

      for (const [index, tag] of obj.tags.entries()) {
        if (typeof tag !== "string") {
          errors.push(`Tag at index ${index} must be a string`);
        } else if (tag.length > TAG_MAX_LENGTH) {
          errors.push(
            `Tag "${tag}" is too long (max ${TAG_MAX_LENGTH} characters)`,
          );
        } else if (tag.trim() !== tag) {
          errors.push(
            `Tag "${tag}" cannot have leading or trailing whitespace`,
          );
        }
      }

      // Check for duplicate tags
      const uniqueTags = new Set(obj.tags);
      if (uniqueTags.size !== obj.tags.length) {
        errors.push("Duplicate tags are not allowed");
      }
    }
  }

  // Validate optional modified date
  if (obj.modified !== undefined) {
    if (typeof obj.modified !== "string") {
      errors.push("Modified date must be a string");
    } else if (!DATE_REGEX.test(obj.modified)) {
      errors.push("Modified date must be in YYYY-MM-DD format");
    }
  }

  // Validate optional draft flag
  if (obj.draft !== undefined && typeof obj.draft !== "boolean") {
    errors.push("Draft flag must be a boolean");
  }

  // Validate optional author
  if (obj.author !== undefined) {
    if (typeof obj.author !== "string") {
      errors.push("Author must be a string");
    } else if (obj.author.length > 100) {
      errors.push("Author name must be no more than 100 characters");
    }
  }

  // Validate optional category
  if (obj.category !== undefined) {
    if (typeof obj.category !== "string") {
      errors.push("Category must be a string");
    } else if (obj.category.length > 50) {
      errors.push("Category must be no more than 50 characters");
    }
  }

  if (errors.length > 0) {
    return err(createError(
      "ValidationError",
      `Frontmatter validation failed: ${errors.join(", ")}`,
      undefined,
      { retryable: false },
    ));
  }

  // Normalize the date field to string format
  const normalizedObj = { ...obj };
  if (normalizedObj.date instanceof Date) {
    normalizedObj.date = normalizedObj.date.toISOString().split("T")[0] ?? "";
  }

  return ok(normalizedObj as FrontmatterSchema);
}

/**
 * Validate markdown content for common issues
 */
export function validateMarkdownContent(content: string): AppResult<string> {
  const errors: string[] = [];

  // Check for minimum content length
  if (content.trim().length < 10) {
    errors.push("Content is too short (minimum 10 characters)");
  }

  // Check for maximum content length (reasonable limit)
  if (content.length > 100000) {
    errors.push("Content is too long (maximum 100,000 characters)");
  }

  // Check for broken internal links (basic check)
  const internalLinkRegex = /\[([^\]]+)\]\(\/[^)]+\)/g;
  const internalLinks = [...content.matchAll(internalLinkRegex)];

  for (const match of internalLinks) {
    const url = match[0].match(/\(([^)]+)\)/)?.[1];
    if (
      url && !url.startsWith("/posts/") && !url.startsWith("/tags/") &&
      url !== "/about" && url !== "/"
    ) {
      errors.push(`Potentially broken internal link: ${url}`);
    }
  }

  // Check for unclosed code blocks
  const codeBlockMatches = content.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    errors.push("Unclosed code block detected");
  }

  // Check for unclosed inline code
  const inlineCodeMatches = content.match(/`/g);
  if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) {
    errors.push("Unclosed inline code detected");
  }

  if (errors.length > 0) {
    return err(createError(
      "ValidationError",
      `Content validation failed: ${errors.join(", ")}`,
      undefined,
      { retryable: false },
    ));
  }

  return ok(content);
}

/**
 * Validate that referenced media files (images/audio) exist (basic check)
 */
export function validateImageReferences(content: string): AppResult<string[]> {
  const mediaRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const mediaFiles: string[] = [];
  const errors: string[] = [];

  let match;
  while ((match = mediaRegex.exec(content)) !== null) {
    const mediaPath = match[2];
    if (!mediaPath) continue; // Skip if no media path found

    mediaFiles.push(mediaPath);

    // Basic validation for media paths
    if (!mediaPath.startsWith("/") && !mediaPath.startsWith("http")) {
      errors.push(`Media path should be absolute or HTTP(S): ${mediaPath}`);
    }

    // Check for common image and audio extensions
    const validExtensions = [
      ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", // images
      ".mp3", ".wav", ".ogg", ".m4a", ".flac", // audio
    ];
    const hasValidExtension = validExtensions.some((ext) =>
      mediaPath.toLowerCase().includes(ext)
    );

    if (!hasValidExtension) {
      errors.push(`Media file may have invalid extension: ${mediaPath}`);
    }
  }

  if (errors.length > 0) {
    return err(createError(
      "ValidationError",
      `Media validation failed: ${errors.join(", ")}`,
      undefined,
      { retryable: false },
    ));
  }

  return ok(mediaFiles);
}
