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
  readonly topics?: readonly string[]; // Optional, derived automatically if absent
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

type Rule = (obj: Readonly<Record<string, unknown>>) => readonly string[];

type StringCheck = {
  readonly test: (value: string) => boolean;
  readonly message: string;
};

// Convert a YAML Date or a string to a string; other values give undefined
const normalizeDate = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString().split("T")[0] ?? "";
  return typeof value === "string" ? value : undefined;
};

const titleRule: Rule = ({ title }) => {
  if (!title || typeof title !== "string") {
    return ["Title is required and must be a string"];
  }
  return title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH
    ? [
      `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters`,
    ]
    : [];
};

// Date is required (YAML may supply a Date object); future dates fail unless draft
const dateRule = (now: Date): Rule => (obj) => {
  if (!obj.date) return ["Date is required"];
  const dateString = normalizeDate(obj.date);
  if (dateString === undefined) return ["Date must be a string or Date object"];
  if (!dateString) return [];
  if (!DATE_REGEX.test(dateString)) {
    return ["Date must be in YYYY-MM-DD format"];
  }
  return new Date(dateString) > now && !obj.draft
    ? ["Published posts cannot have future dates"]
    : [];
};

const optionalString =
  (field: string, typeMessage: string, check?: StringCheck): Rule => (obj) => {
    const value = obj[field];
    if (value === undefined) return [];
    if (typeof value !== "string") return [typeMessage];
    return check && !check.test(value) ? [check.message] : [];
  };

const maxLength = (max: number, message: string): StringCheck => ({
  test: (value) => value.length <= max,
  message,
});

const stringList = (
  field: string,
  words: {
    readonly plural: string; // "Tags"
    readonly singular: string; // "Tag"
    readonly lower: string; // "tags"
  },
): Rule =>
(obj) => {
  const list = obj[field];
  if (list === undefined) return [];
  if (!Array.isArray(list)) return [`${words.plural} must be an array`];
  const itemMessages = list.flatMap((item: unknown, index: number) => {
    if (typeof item !== "string") {
      return [`${words.singular} at index ${index} must be a string`];
    }
    if (item.length > TAG_MAX_LENGTH) {
      return [
        `${words.singular} "${item}" is too long (max ${TAG_MAX_LENGTH} characters)`,
      ];
    }
    return item.trim() !== item
      ? [
        `${words.singular} "${item}" cannot have leading or trailing whitespace`,
      ]
      : [];
  });
  return [
    ...(list.length > MAX_TAGS
      ? [`Cannot have more than ${MAX_TAGS} ${words.lower}`]
      : []),
    ...itemMessages,
    ...(new Set(list).size !== list.length
      ? [`Duplicate ${words.lower} are not allowed`]
      : []),
  ];
};

const draftRule: Rule = ({ draft }) =>
  draft !== undefined && typeof draft !== "boolean"
    ? ["Draft flag must be a boolean"]
    : [];

/**
 * Validate frontmatter data against schema
 */
export function validateFrontmatter(
  data: unknown,
  now: Date = new Date(),
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
  const rules: readonly Rule[] = [
    titleRule,
    dateRule(now),
    optionalString("slug", "Slug must be a string", {
      test: (value) => SLUG_REGEX.test(value),
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
    optionalString(
      "excerpt",
      "Excerpt must be a string",
      maxLength(
        EXCERPT_MAX_LENGTH,
        `Excerpt must be no more than ${EXCERPT_MAX_LENGTH} characters`,
      ),
    ),
    stringList("tags", { plural: "Tags", singular: "Tag", lower: "tags" }),
    stringList("topics", {
      plural: "Topics",
      singular: "Topic",
      lower: "topics",
    }),
    optionalString("modified", "Modified date must be a string", {
      test: (value) => DATE_REGEX.test(value),
      message: "Modified date must be in YYYY-MM-DD format",
    }),
    draftRule,
    optionalString(
      "author",
      "Author must be a string",
      maxLength(100, "Author name must be no more than 100 characters"),
    ),
    optionalString(
      "category",
      "Category must be a string",
      maxLength(50, "Category must be no more than 50 characters"),
    ),
  ];

  const errors = rules.flatMap((rule) => rule(obj));
  if (errors.length > 0) {
    return err(createError(
      "ValidationError",
      `Frontmatter validation failed: ${errors.join(", ")}`,
      undefined,
      { retryable: false },
    ));
  }

  // Normalize the date field to string format; unknown keys survive
  return ok({ ...obj, date: normalizeDate(obj.date) } as FrontmatterSchema);
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

  // Check for broken internal links (basic check, excludes image syntax ![...])
  const internalLinkRegex = /(?<!!)\[([^\]]+)\]\(\/[^)]+\)/g;
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
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".svg",
      ".webp", // images
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
      ".flac", // audio
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
