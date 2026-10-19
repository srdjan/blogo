import { assertEquals, assertExists } from "@std/assert";
import { createContentService } from "../../src/domain/content.ts";
import { createMemoryFileSystem } from "../helpers/file_system.ts";
import { createRecordingLogger } from "../helpers/logger.ts";
import { createInMemoryCache } from "../../src/ports/cache.ts";
import {
  type AppResult,
  createSlug,
  type Post,
  type PostMeta,
  type TagName,
} from "../../src/lib/types.ts";
import { createError } from "../../src/lib/error.ts";
import { err, ok } from "../../src/lib/result.ts";

Deno.test("ContentService - loads valid posts successfully", async () => {
  const mockFiles = {
    "content/posts/test-post.md": `---
title: Test Post
date: 2025-01-15
excerpt: A test post
tags:
  - Testing
  - Blog
---

# Test Content

This is a test post with some content.`,

    "content/posts/another-post.md": `---
title: Another Post
date: 2025-01-14
---

# Another Test

More content here.`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.loadPosts();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 2);
    assertEquals(result.value[0]?.title, "Test Post"); // Should be sorted by date (newest first)
    assertEquals(result.value[1]?.title, "Another Post");
  }
});

Deno.test("ContentService - handles malformed frontmatter gracefully", async () => {
  const mockFiles = {
    "content/posts/bad-post.md": `---
title: Missing Date
invalid yaml: [
---

# Content

This post has invalid frontmatter.`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.loadPosts();

  assertEquals(result.ok, false);
  if (!result.ok) {
    // Malformed YAML causes ParseError, not ValidationError
    assertEquals(result.error.kind, "ParseError");
  }
});

Deno.test("ContentService - returns an empty list for an empty posts directory", async () => {
  const fileSystem = createMemoryFileSystem({});
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.loadPosts();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 0);
  }
});

Deno.test("ContentService - getPostBySlug returns correct post", async () => {
  const mockFiles = {
    "content/posts/test-post.md": `---
title: Test Post
date: 2025-01-15
---

# Test Content`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.getPostBySlug(createSlug("test-post"));

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.value);
    assertEquals(result.value?.title, "Test Post");
  }
});

Deno.test("ContentService - getPostBySlug returns null for non-existent post", async () => {
  const mockFiles = {
    "content/posts/test-post.md": `---
title: Test Post
date: 2025-01-15
---

# Test Content`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.getPostBySlug(createSlug("non-existent"));

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value, null);
  }
});

Deno.test("ContentService - getPostsByTag filters correctly", async () => {
  const mockFiles = {
    "content/posts/tagged-post.md": `---
title: Tagged Post
date: 2025-01-15
tags:
  - JavaScript
  - Testing
---

# Tagged Content`,

    "content/posts/untagged-post.md": `---
title: Untagged Post
date: 2025-01-14
---

# Untagged Content`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.getPostsByTag("JavaScript" as TagName);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 1);
    assertEquals(result.value[0]?.title, "Tagged Post");
  }
});

Deno.test("ContentService - getTags returns correct tag info", async () => {
  const mockFiles = {
    "content/posts/post1.md": `---
title: Post 1
date: 2025-01-15
tags:
  - JavaScript
  - Testing
---

# Content 1`,

    "content/posts/post2.md": `---
title: Post 2
date: 2025-01-14
tags:
  - JavaScript
  - Tutorial
---

# Content 2`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.getTags();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 3);
    // Should be sorted by count (descending)
    assertEquals(result.value[0]?.name, "JavaScript");
    assertEquals(result.value[0]?.count, 2);
  }
});

Deno.test("ContentService - searchPosts finds matching content", async () => {
  const mockFiles = {
    "content/posts/searchable.md": `---
title: Searchable Post
date: 2025-01-15
excerpt: This post is about TypeScript
tags:
  - TypeScript
---

# TypeScript Tutorial

Learn about TypeScript features.`,

    "content/posts/other.md": `---
title: Other Post
date: 2025-01-14
---

# JavaScript Guide

This is about JavaScript.`,
  };

  const fileSystem = createMemoryFileSystem(mockFiles);
  const logger = createRecordingLogger();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: "content/posts",
  });

  const result = await contentService.searchPosts("TypeScript");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 1);
    assertEquals(result.value[0]?.title, "Searchable Post");
  }
});

Deno.test("ContentService - hides draft posts from every reader", async () => {
  const mockFiles = {
    "content/posts/live-post.md": `---
title: Live Post
date: 2025-01-15
tags:
  - Public
---

# Live

Visible content about apples.`,

    "content/posts/draft-post.md": `---
title: Draft Post
date: 2025-01-16
tags:
  - Secret
draft: true
---

# Draft

Hidden content about zebras.`,
  };

  const postCache = createInMemoryCache<Post>();
  const contentService = createContentService({
    fileSystem: createMemoryFileSystem(mockFiles),
    logger: createRecordingLogger(),
    cache: createInMemoryCache<readonly Post[]>(),
    metadataCache: createInMemoryCache<readonly PostMeta[]>(),
    postCache,
    postsDir: "content/posts",
  });

  const posts = await contentService.loadPosts();
  assertEquals(posts.ok && posts.value.map((p) => p.title), ["Live Post"]);

  const metadata = await contentService.loadPostsMetadata();
  assertEquals(metadata.ok && metadata.value.map((p) => p.title), [
    "Live Post",
  ]);

  const tags = await contentService.getTags();
  assertEquals(tags.ok && tags.value.map((t) => String(t.name)), ["Public"]);

  const search = await contentService.searchPosts("zebras");
  assertEquals(search.ok && search.value.length, 0);

  const draft = await contentService.getPostBySlug(createSlug("draft-post"));
  assertEquals(draft.ok && draft.value, null);
  const cached = postCache.get("draft-post");
  assertEquals(cached.ok && cached.value.status, "miss");
});

// --- edge cases: sorting, filtering, caching, search, view counts ---

const POSTS_DIR = "content/posts";

const postFile = (
  title: string,
  date: string,
  extra: { readonly tags?: readonly string[]; readonly body?: string } = {},
): string =>
  `---
title: ${title}
date: ${date}
${
    extra.tags
      ? `tags:\n${extra.tags.map((t) => `  - ${t}`).join("\n")}\n`
      : ""
  }---

${extra.body ?? `# ${title}`}`;

type AnalyticsDouble = {
  readonly getAllViewCounts: () => Promise<AppResult<Record<string, number>>>;
};

const createService = (
  files: Record<string, string>,
  options: {
    readonly analyticsService?: AnalyticsDouble;
    readonly failDirs?: ReadonlySet<string>;
  } = {},
) => {
  const fileSystem = createMemoryFileSystem(
    files,
    options.failDirs ? { failOn: options.failDirs } : {},
  );
  const service = createContentService({
    fileSystem,
    logger: createRecordingLogger(),
    cache: createInMemoryCache<readonly Post[]>(),
    metadataCache: createInMemoryCache<readonly PostMeta[]>(),
    postCache: createInMemoryCache<Post>(),
    postsDir: POSTS_DIR,
    ...(options.analyticsService
      ? { analyticsService: options.analyticsService }
      : {}),
  });
  return { service, fileSystem };
};

const TWO_POSTS = {
  [`${POSTS_DIR}/post-a.md`]: postFile("Post A", "2025-01-10", {
    tags: ["TypeScript"],
    body: "# Alpha\n\nDeno runtime notes.",
  }),
  [`${POSTS_DIR}/post-b.md`]: postFile("Post B", "2025-02-10"),
};

Deno.test("ContentService - sorts posts newest first", async () => {
  const { service } = createService({
    [`${POSTS_DIR}/old.md`]: postFile("Old", "2025-01-10"),
    [`${POSTS_DIR}/new.md`]: postFile("New", "2025-03-01"),
    [`${POSTS_DIR}/mid.md`]: postFile("Mid", "2025-02-01"),
  });

  const result = await service.loadPosts();

  assertEquals(result.ok && result.value.map((p) => p.title), [
    "New",
    "Mid",
    "Old",
  ]);
});

Deno.test("ContentService - ignores files that are not markdown", async () => {
  const { service } = createService({
    ...TWO_POSTS,
    [`${POSTS_DIR}/notes.txt`]: "not a post, no frontmatter",
    [`${POSTS_DIR}/.DS_Store`]: "binary",
  });

  const result = await service.loadPosts();

  assertEquals(result.ok && result.value.length, 2);
});

Deno.test("ContentService - returns an error result when the posts directory cannot be read", async () => {
  const { service } = createService(TWO_POSTS, {
    failDirs: new Set([POSTS_DIR]),
  });

  const result = await service.loadPosts();

  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.error.kind, "IOError");
});

Deno.test("ContentService - a second loadPosts call reads nothing from the file system", async () => {
  const { service, fileSystem } = createService(TWO_POSTS);

  const first = await service.loadPosts();
  const readsAfterFirst = { ...fileSystem.calls };
  const second = await service.loadPosts();

  assertEquals(readsAfterFirst.readDir, 1);
  assertEquals(readsAfterFirst.readFile, 2);
  assertEquals(fileSystem.calls, readsAfterFirst);
  assertEquals(second, first);
});

Deno.test("ContentService - search ignores case in the query and in the post", async () => {
  const { service } = createService(TWO_POSTS);

  for (const query of ["typescript", "TYPESCRIPT", "deno RUNTIME"]) {
    const result = await service.searchPosts(query);
    assertEquals(
      result.ok && result.value.map((p) => p.title),
      ["Post A"],
      query,
    );
  }
});

Deno.test("ContentService - an empty search query returns every post", async () => {
  const { service } = createService(TWO_POSTS);

  const result = await service.searchPosts("");

  assertEquals(result.ok && result.value.length, 2);
});

Deno.test("ContentService - getPostsByTag returns an empty list for an unknown tag", async () => {
  const { service } = createService(TWO_POSTS);

  const result = await service.getPostsByTag("Nothing" as TagName);

  assertEquals(result, ok([]));
});

Deno.test("ContentService - getPostsByTag ignores the case of the tag", async () => {
  const { service } = createService(TWO_POSTS);

  const result = await service.getPostsByTag("typescript" as TagName);

  assertEquals(result.ok && result.value.map((p) => p.title), ["Post A"]);
});

const viewCounts = (counts: Record<string, number>): AnalyticsDouble => ({
  getAllViewCounts: () => Promise.resolve(ok(counts)),
});

const failingViewCounts: AnalyticsDouble = {
  getAllViewCounts: () =>
    Promise.resolve(err(createError("IOError", "analytics down"))),
};

Deno.test("ContentService - loadPostsMetadataWithViews merges view counts and uses 0 for a missing count", async () => {
  const { service } = createService(TWO_POSTS, {
    analyticsService: viewCounts({ "post-a": 5 }),
  });

  const result = await service.loadPostsMetadataWithViews();

  assertEquals(
    result.ok && result.value.map((p) => [p.title, p.viewCount]),
    [["Post B", 0], ["Post A", 5]],
  );
});

Deno.test("ContentService - loadPostsWithViews merges view counts and uses 0 for a missing count", async () => {
  const { service } = createService(TWO_POSTS, {
    analyticsService: viewCounts({ "post-a": 5 }),
  });

  const result = await service.loadPostsWithViews();

  assertEquals(
    result.ok && result.value.map((p) => [p.title, p.viewCount]),
    [["Post B", 0], ["Post A", 5]],
  );
});

Deno.test("ContentService - view-count failures differ between the two WithViews readers", async () => {
  const metadata = await createService(TWO_POSTS, {
    analyticsService: failingViewCounts,
  }).service.loadPostsMetadataWithViews();
  const full = await createService(TWO_POSTS, {
    analyticsService: failingViewCounts,
  }).service.loadPostsWithViews();

  // Current behavior; see plan finding B10
  assertEquals(
    metadata.ok && metadata.value.map((p) => p.viewCount),
    [0, 0],
  );
  assertEquals(
    full.ok && full.value.map((p) => p.viewCount),
    [undefined, undefined],
  );
});
