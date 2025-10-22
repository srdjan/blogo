import { assertEquals, assertExists } from "@std/assert";
import { createContentService } from "../../src/domain/content.ts";
import type { FileSystem } from "../../src/ports/file-system.ts";
import type { Logger } from "../../src/ports/logger.ts";
import type { Cache } from "../../src/ports/cache.ts";
import { createInMemoryCache } from "../../src/ports/cache.ts";
import { createSlug, type Post } from "../../src/lib/types.ts";

// Mock FileSystem implementation for testing
function createMockFileSystem(files: Record<string, string>): FileSystem {
  return {
    readFile: async (path: string): Promise<string> => {
      if (path in files) {
        return files[path] ?? "";
      }
      throw new Error(`File not found: ${path}`);
    },

    readDir: async (path: string): Promise<readonly string[]> => {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      return Object.keys(files)
        .filter((filePath) => filePath.startsWith(prefix))
        .map((filePath) => filePath.substring(prefix.length))
        .filter((name) => !name.includes("/"));
    },

    exists: async (path: string): Promise<boolean> => {
      return path in files;
    },

    stat: async (path: string) => {
      if (!(path in files)) return null;
      return {
        name: path.split("/").pop() ?? path,
        isFile: true,
        isDirectory: false,
        size: files[path]?.length ?? 0,
        mtime: new Date(),
      };
    },
  };
}

// Mock Logger implementation for testing
function createMockLogger(): Logger {
  const logs: Array<{ level: string; message: string; data?: unknown }> = [];

  return {
    error: (message: string, data?: unknown) => {
      logs.push({ level: "error", message, data });
    },
    warn: (message: string, data?: unknown) => {
      logs.push({ level: "warn", message, data });
    },
    info: (message: string, data?: unknown) => {
      logs.push({ level: "info", message, data });
    },
    debug: (message: string, data?: unknown) => {
      logs.push({ level: "debug", message, data });
    },
  };
}

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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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
  const fileSystem = createMockFileSystem({});
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
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

  const fileSystem = createMockFileSystem(mockFiles);
  const logger = createMockLogger();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    postsDir: "content/posts",
  });

  const result = await contentService.searchPosts("TypeScript");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 1);
    assertEquals(result.value[0]?.title, "Searchable Post");
  }
});
