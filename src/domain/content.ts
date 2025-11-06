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
import { TOPICS } from "../config/topics.ts";

export interface ContentService {
  readonly loadPosts: () => Promise<AppResult<readonly Post[]>>;
  readonly loadPostsMetadata: () => Promise<AppResult<readonly PostMeta[]>>;
  readonly loadPostsMetadataWithViews: () => Promise<
    AppResult<readonly Post[]>
  >;
  readonly loadPostsWithViews: () => Promise<AppResult<readonly Post[]>>;
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
  readonly metadataCache: Cache<readonly PostMeta[]>;
  readonly postsDir: string;
  readonly enableValidation?: boolean;
  readonly analyticsService?: {
    readonly getAllViewCounts: () => Promise<AppResult<Record<string, number>>>;
  };
};

export const createContentService = (
  deps: ContentDependencies,
): ContentService => {
  const {
    fileSystem,
    logger,
    cache,
    metadataCache,
    postsDir,
    enableValidation = true,
    analyticsService,
  } = deps;

  const parseMarkdown = async (
    filePath: string,
    slug: Slug,
  ): Promise<AppResult<Post>> => {
    try {
      const content = await fileSystem.readFile(filePath);
      const result = extractFrontmatter(content);

      if (!result.ok) return result;

      const { frontmatter, markdown } = result.value;

      // Validate markdown content (skip in production for performance)
      if (enableValidation) {
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

  // Metadata-only parsing: extracts frontmatter without markdown→HTML conversion
  const parseMetadata = async (
    filePath: string,
    slug: Slug,
  ): Promise<AppResult<PostMeta>> => {
    try {
      const content = await fileSystem.readFile(filePath);
      const result = extractFrontmatter(content);

      if (!result.ok) return result;

      const { frontmatter } = result.value;
      const metaResult = await parseFrontmatter(frontmatter, slug);

      return metaResult;
    } catch (error) {
      return err(createError(
        "IOError",
        `Failed to parse metadata from file: ${filePath}`,
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

  const loadPostsMetadataFromDisk = async (): Promise<
    AppResult<readonly PostMeta[]>
  > => {
    try {
      const entries = await fileSystem.readDir(postsDir);
      const markdownFiles = entries.filter((name) => name.endsWith(".md"));

      if (markdownFiles.length === 0) {
        logger.warn(`No markdown files found in ${postsDir}`);
        return ok([]);
      }

      const metaResults = await Promise.all(
        markdownFiles.map(async (filename) => {
          const slug = filename.replace(/\.md$/, "") as Slug;
          const filePath = `${postsDir}/${filename}`;
          return await parseMetadata(filePath, slug);
        }),
      );

      const combinedResult = combine(metaResults);

      if (!combinedResult.ok) {
        logger.error("Failed to load some post metadata", combinedResult.error);
        return combinedResult;
      }

      const sortedMeta = [...combinedResult.value].sort((
        a: PostMeta,
        b: PostMeta,
      ) => new Date(b.date).getTime() - new Date(a.date).getTime());

      logger.info(`Loaded metadata for ${sortedMeta.length} posts`);
      return ok(sortedMeta);
    } catch (error) {
      return err(createError(
        "IOError",
        `Failed to load post metadata from ${postsDir}`,
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
      cache.set("posts", result.value, 30 * 60 * 1000); // 30 minutes TTL
    }

    return result;
  };

  const loadPostsMetadata = async (): Promise<
    AppResult<readonly PostMeta[]>
  > => {
    const cached = metadataCache.get("metadata");

    if (cached.ok && cached.value) {
      logger.debug("Using cached post metadata");
      return ok(cached.value);
    }

    logger.info("Loading post metadata from disk");
    const result = await loadPostsMetadataFromDisk();

    if (result.ok) {
      metadataCache.set("metadata", result.value, 30 * 60 * 1000); // 30 minutes TTL
    }

    return result;
  };

  const loadPostsMetadataWithViews = async (): Promise<
    AppResult<readonly Post[]>
  > => {
    const metadataResult = await loadPostsMetadata();
    if (!metadataResult.ok) return metadataResult;

    if (!analyticsService) {
      // Convert metadata to Post format without view counts
      const postsWithoutContent = metadataResult.value.map((meta) => ({
        ...meta,
        content: "", // Empty content for metadata-only posts
        formattedDate: formatDate(meta.date),
        viewCount: 0,
      }));
      return ok(postsWithoutContent);
    }

    const viewCountsResult = await analyticsService.getAllViewCounts();
    if (!viewCountsResult.ok) {
      logger.warn("Failed to load view counts, returning posts without views");
      const postsWithoutViews = metadataResult.value.map((meta) => ({
        ...meta,
        content: "", // Empty content for metadata-only posts
        formattedDate: formatDate(meta.date),
        viewCount: 0,
      }));
      return ok(postsWithoutViews);
    }

    const viewCounts = viewCountsResult.value;
    const postsWithViews = metadataResult.value.map((meta) => ({
      ...meta,
      content: "", // Empty content for metadata-only posts
      formattedDate: formatDate(meta.date),
      viewCount: viewCounts[meta.slug] || 0,
    }));

    return ok(postsWithViews);
  };

  const loadPostsWithViews = async (): Promise<AppResult<readonly Post[]>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    if (!analyticsService) {
      // If no analytics service, return posts without view counts
      return postsResult;
    }

    const viewCountsResult = await analyticsService.getAllViewCounts();
    if (!viewCountsResult.ok) {
      logger.warn("Failed to load view counts, returning posts without views");
      return postsResult;
    }

    const viewCounts = viewCountsResult.value;
    const postsWithViews = postsResult.value.map((post) => ({
      ...post,
      viewCount: viewCounts[post.slug] || 0,
    }));

    return ok(postsWithViews);
  };

  const getPostBySlug = async (slug: Slug): Promise<AppResult<Post | null>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    const post = postsResult.value.find((p) => p.slug === slug) ?? null;
    return ok(post);
  };

  // Case-insensitive tag normalization helpers (kept pure)
  const normalizeTag = (s: string): string => s.trim().toLowerCase();
  const canonicalCaseFromTopics = (lower: string): string | null => {
    for (const tags of Object.values(TOPICS)) {
      for (const t of tags) {
        if (t.trim().toLowerCase() === lower) return t;
      }
    }
    return null;
  };

  const getPostsByTag = async (
    tagName: TagName,
  ): Promise<AppResult<readonly Post[]>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    const needle = normalizeTag(String(tagName));
    const filteredPosts = postsResult.value.filter((post) =>
      post.tags
        ? post.tags.some((t) => normalizeTag(String(t)) === needle)
        : false
    );

    return ok(filteredPosts);
  };

  const getTags = async (): Promise<AppResult<readonly TagInfo[]>> => {
    const postsResult = await loadPosts();
    if (!postsResult.ok) return postsResult;

    // Aggregate tags case-insensitively, preserving a canonical display casing.
    const tagMap = new Map<string, TagInfo>(); // key: lowercased tag

    for (const post of postsResult.value) {
      if (!post.tags || post.tags.length === 0) continue;
      const seenInThisPost = new Set<string>();
      for (const raw of post.tags) {
        const key = normalizeTag(String(raw));
        if (seenInThisPost.has(key)) continue; // avoid double-counting same tag variant within one post
        seenInThisPost.add(key);

        const canonical = canonicalCaseFromTopics(key) ?? String(raw);
        const existing = tagMap.get(key);
        const displayName = existing?.name ?? (canonical as TagName);

        const postsArr = existing?.posts ?? [];
        const alreadyIncluded = postsArr.includes(post);
        const updated: TagInfo = {
          name: displayName,
          count: (existing?.count ?? 0) + (alreadyIncluded ? 0 : 1),
          posts: alreadyIncluded ? postsArr : [...postsArr, post],
        };
        tagMap.set(key, updated);
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
    loadPostsMetadata,
    loadPostsMetadataWithViews,
    loadPostsWithViews,
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
