import type {
  AppResult,
  Post,
  PostMeta,
  Slug,
  TagInfo,
  TagName,
} from "../lib/types.ts";
import { createSlug } from "../lib/types.ts";
import type { Result } from "../lib/result.ts";
import { combine, err, ok } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import type { FileSystem } from "../ports/file-system.ts";
import type { Logger } from "../ports/logger.ts";
import { type Cache, createInMemoryCache } from "../ports/cache.ts";
import { markdownToHtml } from "../markdown-renderer.tsx";
import {
  validateFrontmatter,
  validateImageReferences,
  validateMarkdownContent,
} from "./validation.ts";
import { TOPICS } from "../config/topics.ts";
import { parse as parseYaml } from "@std/yaml";

// Pure helper functions for tag normalization
const normalizeTag = (s: string): string => s.trim().toLowerCase();

const canonicalCaseFromTopics = (lower: string): string | null => {
  for (const tags of Object.values(TOPICS)) {
    for (const t of tags) {
      if (t.trim().toLowerCase() === lower) return t;
    }
  }
  return null;
};

// Pure function: aggregates tags from posts without any service dependencies
export const aggregateTags = (
  posts: readonly Post[],
): readonly TagInfo[] => {
  const tagMap = new Map<string, TagInfo>();

  for (const post of posts) {
    if (!post.tags || post.tags.length === 0) continue;
    const seenInThisPost = new Set<string>();

    for (const raw of post.tags) {
      const key = normalizeTag(String(raw));
      if (seenInThisPost.has(key)) continue;
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

  return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
};

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
  readonly postCache: Cache<Post>;
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
    postCache,
    postsDir,
    enableValidation = true,
    analyticsService,
  } = deps;

  const viewCountsCache = createInMemoryCache<Record<string, number>>();
  const viewCountsCacheKey = "view-counts";
  const viewCountsCacheTtlMs = 5 * 60 * 1000; // 5 minutes
  let lastKnownViewCounts: Record<string, number> | null = null;
  let viewCountsRefreshInFlight = false;

  const refreshViewCountsInBackground = (): void => {
    if (viewCountsRefreshInFlight || !analyticsService) return;
    viewCountsRefreshInFlight = true;
    analyticsService.getAllViewCounts().then((result) => {
      if (result.ok) {
        lastKnownViewCounts = result.value;
        viewCountsCache.set(viewCountsCacheKey, result.value, viewCountsCacheTtlMs);
      }
    }).catch(() => {
      // Silently ignore background refresh errors
    }).finally(() => {
      viewCountsRefreshInFlight = false;
    });
  };

  const getAllViewCountsCached = async (): Promise<
    AppResult<Record<string, number>>
  > => {
    if (!analyticsService) {
      return ok({});
    }

    const cached = viewCountsCache.get(viewCountsCacheKey);
    if (cached.ok && cached.value.status === "hit") {
      return ok(cached.value.value);
    }

    // Cache miss: return stale data immediately if available, refresh in background
    if (lastKnownViewCounts !== null) {
      refreshViewCountsInBackground();
      return ok(lastKnownViewCounts);
    }

    // First-ever load: must block
    const result = await analyticsService.getAllViewCounts();
    if (result.ok) {
      lastKnownViewCounts = result.value;
      viewCountsCache.set(
        viewCountsCacheKey,
        result.value,
        viewCountsCacheTtlMs,
      );
    }
    return result;
  };

  const parseMarkdown = async (
    filePath: string,
    slug: Slug,
  ): Promise<AppResult<Post>> => {
    const contentResult = await fileSystem.readFile(filePath);
    if (!contentResult.ok) return contentResult;

    const content = contentResult.value;
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

    const metaResult = parseFrontmatter(frontmatter, slug);

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
  };

  // Metadata-only parsing: extracts frontmatter without markdown->HTML conversion
  const parseMetadata = async (
    filePath: string,
    slug: Slug,
  ): Promise<AppResult<PostMeta>> => {
    const contentResult = await fileSystem.readFile(filePath);
    if (!contentResult.ok) return contentResult;

    const result = extractFrontmatter(contentResult.value);
    if (!result.ok) return result;

    const { frontmatter } = result.value;
    return parseFrontmatter(frontmatter, slug);
  };

  const loadPostsFromDisk = async (): Promise<AppResult<readonly Post[]>> => {
    const entriesResult = await fileSystem.readDir(postsDir);
    if (!entriesResult.ok) return entriesResult;

    const markdownFiles = entriesResult.value.filter((name) =>
      name.endsWith(".md")
    );

    if (markdownFiles.length === 0) {
      logger.warn(`No markdown files found in ${postsDir}`);
      return ok([]);
    }

    const postResults = await Promise.all(
      markdownFiles.map(async (filename) => {
        const slug = createSlug(filename.replace(/\.md$/, ""));
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
  };

  const loadPostsMetadataFromDisk = async (): Promise<
    AppResult<readonly PostMeta[]>
  > => {
    const entriesResult = await fileSystem.readDir(postsDir);
    if (!entriesResult.ok) return entriesResult;

    const markdownFiles = entriesResult.value.filter((name) =>
      name.endsWith(".md")
    );

    if (markdownFiles.length === 0) {
      logger.warn(`No markdown files found in ${postsDir}`);
      return ok([]);
    }

    const metaResults = await Promise.all(
      markdownFiles.map(async (filename) => {
        const slug = createSlug(filename.replace(/\.md$/, ""));
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
  };

  const loadPosts = async (): Promise<AppResult<readonly Post[]>> => {
    const cached = cache.get("posts");

    if (cached.ok && cached.value.status === "hit") {
      logger.debug("Using cached posts");
      return ok(cached.value.value);
    }

    logger.info("Loading posts from disk");
    const result = await loadPostsFromDisk();

    if (result.ok) {
      cache.set("posts", result.value, Infinity);
    }

    return result;
  };

  const loadPostsMetadata = async (): Promise<
    AppResult<readonly PostMeta[]>
  > => {
    const cached = metadataCache.get("metadata");

    if (cached.ok && cached.value.status === "hit") {
      logger.debug("Using cached post metadata");
      return ok(cached.value.value);
    }

    logger.info("Loading post metadata from disk");
    const result = await loadPostsMetadataFromDisk();

    if (result.ok) {
      metadataCache.set("metadata", result.value, Infinity);
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

    const viewCountsResult = await getAllViewCountsCached();
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

    const viewCountsResult = await getAllViewCountsCached();
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
    // Check individual post cache first (fast path)
    const cached = postCache.get(slug as string);
    if (cached.ok && cached.value.status === "hit") {
      logger.debug(`Using cached post: ${slug}`);
      return ok(cached.value.value);
    }

    // Direct file lookup - O(1) instead of loading all posts
    const filePath = `${postsDir}/${slug}.md`;
    const exists = await fileSystem.exists(filePath);
    if (!exists) {
      // Fallback: check if slug exists with different casing in full posts list
      const postsResult = await loadPosts();
      if (!postsResult.ok) return postsResult;
      const post = postsResult.value.find((p) => p.slug === slug) ?? null;
      return ok(post);
    }

    // Parse the single post directly
    const postResult = await parseMarkdown(filePath, slug);
    if (postResult.ok) {
      postCache.set(slug as string, postResult.value, Infinity);
    }
    return postResult;
  };

  const getPostsByTag = async (
    tagName: TagName,
  ): Promise<AppResult<readonly Post[]>> => {
    const postsResult = await loadPostsMetadata();
    if (!postsResult.ok) return postsResult;

    const needle = normalizeTag(String(tagName));
    const filteredMeta = postsResult.value.filter((post) =>
      post.tags
        ? post.tags.some((t) => normalizeTag(String(t)) === needle)
        : false
    );

    const posts = filteredMeta.map((meta) => ({
      ...meta,
      content: "",
      formattedDate: formatDate(meta.date),
    }));

    return ok(posts);
  };

  const getTags = async (): Promise<AppResult<readonly TagInfo[]>> => {
    const postsResult = await loadPostsMetadata();
    if (!postsResult.ok) return postsResult;

    const posts = postsResult.value.map((meta) => ({
      ...meta,
      content: "",
    }));

    return ok(aggregateTags(posts));
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

// Helper functions - exported for reuse by AT Protocol service
export function extractFrontmatter(
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

function parseFrontmatter(
  frontmatter: string,
  slug: Slug,
): AppResult<PostMeta> {
  try {
    const meta = parseYaml(frontmatter) as Record<string, unknown>;

    // Use comprehensive frontmatter validation
    const validationResult = validateFrontmatter(meta);
    if (!validationResult.ok) {
      return validationResult;
    }

    const validatedMeta = validationResult.value;

    // Convert validated data to PostMeta format
    const dateString = validatedMeta.date;
    const tags = validatedMeta.tags?.map((t) => t as TagName);

    const normalizedSlug = createSlug(
      (validatedMeta.slug as string | undefined) ?? (slug as string),
    );

    const result: PostMeta = {
      title: validatedMeta.title,
      date: dateString,
      slug: normalizedSlug,
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
