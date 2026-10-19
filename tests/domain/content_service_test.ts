import { assertEquals, assertExists } from "@std/assert";
import { createContentService } from "../../src/domain/content.ts";
import { createMemoryFileSystem } from "../helpers/file_system.ts";
import { createRecordingLogger } from "../helpers/logger.ts";
import { createInMemoryCache } from "../../src/ports/cache.ts";
import { createSlug, type Post, type PostMeta } from "../../src/lib/types.ts";

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

Deno.test("ContentService - handles missing files gracefully", async () => {
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

  const result = await contentService.getPostsByTag("JavaScript" as any);

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
