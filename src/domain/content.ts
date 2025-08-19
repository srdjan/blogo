import type {
  AppResult,
  Post,
  PostMeta,
  Slug,
  TagInfo,
  TagName,
} from "../lib/types.ts";
import type { Result } from "../lib/result.ts";
import { combine, err, ok } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import type { FileSystem } from "../ports/file-system.ts";
import type { Logger } from "../ports/logger.ts";
import type { Cache } from "../ports/cache.ts";
import { markdownToHtml } from "../markdown-renderer.tsx";
import {
  validateFrontmatter,
  validateImageReferences,
  validateMarkdownContent,
} from "./validation.ts";

export interface ContentService {
  readonly loadPosts: () => Promise<AppResult<readonly Post[]>>;
  readonly getPostBySlug: (slug: Slug) => Promise<AppResult<Post | null>>;
  readonly getPostsByTag: (
    tagName: TagName,
  ) => Promise<AppResult<readonly Post[]>>;
  readonly getTags: () => Promise<AppResult<readonly TagInfo[]>>;
  readonly searchPosts: (query: string) => Promise<AppResult<readonly Post[]>>;
}

export type ContentDependencies = {
  readonly fileSystem: FileSystem;
  readonly logger: Logger;
  readonly cache: Cache<readonly Post[]>;
  readonly postsDir: string;
};

export const createContentService = (
  deps: ContentDependencies,
): ContentService => {
  const { fileSystem, logger, cache, postsDir } = deps;

  const parseMarkdown = async (
    filePath: string,
    slug: Slug,
  ): Promise<AppResult<Post>> => {
    try {
      const content = await fileSystem.readFile(filePath);
      const result = extractFrontmatter(content);

      if (!result.ok) return result;

      const { frontmatter, markdown } = result.value;

      // Validate markdown content
      const contentValidation = validateMarkdownContent(markdown);
      if (!contentValidation.ok) {
        logger.warn(
          `Content validation issues for ${filePath}`,
          contentValidation.error,
        );
        // Continue processing despite content warnings
      }

      // Validate image references
      const imageValidation = validateImageReferences(markdown);
      if (!imageValidation.ok) {
        logger.warn(
          `Image validation issues for ${filePath}`,
          imageValidation.error,
        );
        // Continue processing despite image warnings
      }

      const metaResult = await parseFrontmatter(frontmatter, slug);

      if (!metaResult.ok) return metaResult;

      const meta = metaResult.value;
      const htmlResult = markdownToHtml(markdown);

      if (!htmlResult.ok) return htmlResult;

      const formattedDate = formatDate(meta.date);

      return ok({
        ...meta,
        content: htmlResult.value,
        formattedDate,
      });
    } catch (error) {
      return err(createError(
        "IOError",
        `Failed to parse markdown file: ${filePath}`,
        error,
        { path: filePath },
      ));
    }
  };

  const loadPostsFromDisk = async (): Promise<AppResult<readonly Post[]>> => {
    try {
      const entries = await fileSystem.readDir(postsDir);
      const markdownFiles = entries.filter((name) => name.endsWith(".md"));

      if (markdownFiles.length === 0) {
        logger.warn(`No markdown files found in ${postsDir}`);
        return ok([]);
      }

      const postResults = await Promise.all(
        markdownFiles.map(async (filename) => {
          const slug = filename.replace(/\.md$/, "") as Slug;
          const filePath = `${postsDir}/${filename}`;
          return await parseMarkdown(filePath, slug);
        }),
      );

      const combinedResult = combine(postResults);

      if (!combinedResult.ok) {
        logger.error("Failed to load some posts", combinedResult.error);
        return combinedResult;
      }

      const sortedPosts = [...combinedResult.value].sort((a: Post, b: Post) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      logger.info(`Loaded ${sortedPosts.length} posts`);
      return ok(sortedPosts);
    } catch (error) {
      return err(createError(
        "IOError",
        `Failed to load posts from ${postsDir}`,
        error,
        { path: postsDir },
      ));
    }
  };

  const loadPosts = async (): Promise<AppResult<readonly Post[]>> => {
    const cached = cache.get("posts");

    if (cached.ok && cached.value) {
      logger.debug("Using cached posts");
      return ok(cached.value);
    }

    logger.info("Loading posts from disk");
    const result = await loadPostsFromDisk();

    if (result.ok) {
      cache.set("posts", result.value, 5 * 60 * 1000); // 5 minutes TTL
    }

    return result;
  };

  const getPostBySlug = async (slug: Slug): Promise<AppResult<Post | null>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    const post = postsResult.value.find((p) => p.slug === slug) ?? null;
    return ok(post);
  };

  const getPostsByTag = async (
    tagName: TagName,
  ): Promise<AppResult<readonly Post[]>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    const filteredPosts = postsResult.value.filter((post) =>
      post.tags?.includes(tagName) ?? false
    );

    return ok(filteredPosts);
  };

  const getTags = async (): Promise<AppResult<readonly TagInfo[]>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    const tagMap = new Map<TagName, TagInfo>();

    for (const post of postsResult.value) {
      if (post.tags) {
        for (const tagName of post.tags) {
          const existing = tagMap.get(tagName);
          if (existing) {
            tagMap.set(tagName, {
              ...existing,
              count: existing.count + 1,
              posts: [...existing.posts, post],
            });
          } else {
            tagMap.set(tagName, {
              name: tagName,
              count: 1,
              posts: [post],
            });
          }
        }
      }
    }

    const tags = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
    return ok(tags);
  };

  const searchPosts = async (
    query: string,
  ): Promise<AppResult<readonly Post[]>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    const lowerQuery = query.toLowerCase();

    const matchingPosts = postsResult.value.filter((post) =>
      post.title.toLowerCase().includes(lowerQuery) ||
      post.content.toLowerCase().includes(lowerQuery) ||
      (post.excerpt && post.excerpt.toLowerCase().includes(lowerQuery)) ||
      (post.tags &&
        post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
    );

    return ok(matchingPosts);
  };

  return {
    loadPosts,
    getPostBySlug,
    getPostsByTag,
    getTags,
    searchPosts,
  };
};

// Helper functions
function extractFrontmatter(
  text: string,
): Result<
  { frontmatter: string; markdown: string },
  import("../lib/types.ts").AppError
> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    return err(createError("ParseError", "Invalid frontmatter format"));
  }

  return ok({
    frontmatter: match[1] || "",
    markdown: match[2] || "",
  });
}

async function parseFrontmatter(
  frontmatter: string,
  slug: Slug,
): Promise<AppResult<PostMeta>> {
  try {
    const { parse } = await import("@std/yaml");
    const meta = parse(frontmatter) as Record<string, unknown>;

    // Use comprehensive frontmatter validation
    const validationResult = validateFrontmatter(meta);
    if (!validationResult.ok) {
      return validationResult;
    }

    const validatedMeta = validationResult.value;

    // Convert validated data to PostMeta format
    const dateString = validatedMeta.date;
    const tags = validatedMeta.tags?.map((t) => t as TagName);

    const result: PostMeta = {
      title: validatedMeta.title,
      date: dateString,
      slug: (validatedMeta.slug as Slug) || slug,
      ...(validatedMeta.excerpt && { excerpt: validatedMeta.excerpt }),
      ...(tags && { tags }),
      ...(validatedMeta.modified && { modified: validatedMeta.modified }),
    };

    return ok(result);
  } catch (error) {
    return err(
      createError("ParseError", "Failed to parse frontmatter YAML", error),
    );
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}
