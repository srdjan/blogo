import { assertEquals } from "@std/assert";
import { createStaticBuilder } from "../../src/domain/static-builder.ts";
import type { ContentService } from "../../src/domain/content.ts";
import type { FileWriter } from "../../src/ports/writer.ts";
import type { Logger } from "../../src/ports/logger.ts";
import type { RouteHandlers } from "../../src/http/routes.tsx";
import type { RouteContext } from "../../src/http/types.ts";
import { ok } from "../../src/lib/result.ts";
import type {
  AppResult,
  Post,
  PostMeta,
  Slug,
  TagInfo,
  TagName,
} from "../../src/lib/types.ts";

// --- Mock helpers ---

function createMockFileWriter(): FileWriter & {
  readonly written: Map<string, string>;
} {
  const written = new Map<string, string>();
  return {
    written,
    writeFile: async (
      path: string,
      content: string,
    ): Promise<AppResult<void>> => {
      written.set(path, content);
      return ok(undefined);
    },
    ensureDir: async (): Promise<AppResult<void>> => ok(undefined),
    copyDir: async (): Promise<AppResult<void>> => ok(undefined),
    clean: async (): Promise<AppResult<void>> => ok(undefined),
  };
}

function createMockLogger(): Logger {
  return {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  };
}

const MOCK_POST: Post = {
  title: "Test Post",
  date: "2025-01-15",
  slug: "test-post" as Slug,
  content: "<h1>Test</h1><p>Content</p>",
  excerpt: "A test post",
  tags: ["TypeScript" as TagName],
  formattedDate: "1/15/2025",
};

const MOCK_TAG: TagInfo = {
  name: "TypeScript" as TagName,
  count: 1,
  posts: [MOCK_POST],
};

function createMockContentService(): ContentService {
  return {
    loadPosts: async () => ok([MOCK_POST]),
    loadPostsMetadata: async () => ok([MOCK_POST as PostMeta]),
    loadPostsMetadataWithViews: async () => ok([MOCK_POST]),
    loadPostsWithViews: async () => ok([MOCK_POST]),
    getPostBySlug: async () => ok(MOCK_POST),
    getPostsByTag: async () => ok([MOCK_POST]),
    getTags: async () => ok([MOCK_TAG]),
    searchPosts: async () => ok([]),
  };
}

function createMockRoutes(): RouteHandlers {
  const htmlHandler = (_ctx: RouteContext) =>
    new Response("<html><body>Page</body></html>", {
      headers: { "Content-Type": "text/html" },
    });

  const xmlHandler = (_ctx: RouteContext) =>
    new Response("<rss>feed</rss>", {
      headers: { "Content-Type": "application/xml" },
    });

  const textHandler = (_ctx: RouteContext) =>
    new Response("User-agent: *", {
      headers: { "Content-Type": "text/plain" },
    });

  const svgHandler = (_ctx: RouteContext) =>
    new Response("<svg></svg>", {
      headers: { "Content-Type": "image/svg+xml" },
    });

  return {
    home: htmlHandler,
    about: htmlHandler,
    tags: htmlHandler,
    tagPosts: htmlHandler,
    post: htmlHandler,
    search: htmlHandler,
    searchModal: htmlHandler,
    rss: xmlHandler,
    rssPage: htmlHandler,
    rssByTopic: xmlHandler,
    sitemap: xmlHandler,
    robots: textHandler,
    ogImageDefault: svgHandler,
    ogImagePost: svgHandler,
    health: htmlHandler,
    atprotoVerification: textHandler,
  };
}

// --- Tests ---

Deno.test("StaticBuilder - generates index.html for root", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  const result = await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(result.ok, true);
  assertEquals(fileWriter.written.has("_site/index.html"), true);
});

Deno.test("StaticBuilder - generates per-post pages", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(
    fileWriter.written.has("_site/posts/test-post/index.html"),
    true,
  );
});

Deno.test("StaticBuilder - generates fragment files alongside full pages", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(fileWriter.written.has("_site/fragment.html"), true);
  assertEquals(
    fileWriter.written.has("_site/posts/test-post/fragment.html"),
    true,
  );
});

Deno.test("StaticBuilder - generates non-HTML routes", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(fileWriter.written.has("_site/feed.xml"), true);
  assertEquals(fileWriter.written.has("_site/sitemap.xml"), true);
  assertEquals(fileWriter.written.has("_site/robots.txt"), true);
  assertEquals(
    fileWriter.written.has("_site/images/og-default.svg"),
    true,
  );
});

Deno.test("StaticBuilder - generates per-tag pages", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(
    fileWriter.written.has("_site/tags/TypeScript/index.html"),
    true,
  );
});

Deno.test("StaticBuilder - report counts match generated files", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  const result = await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    // Count HTML files (pages) vs fragment files
    const indexFiles = [...fileWriter.written.keys()].filter(
      (k) => k.endsWith("/index.html") || k === "_site/index.html",
    );
    const fragFiles = [...fileWriter.written.keys()].filter((k) =>
      k.endsWith("/fragment.html") || k === "_site/fragment.html"
    );

    // pages = total routes rendered (HTML + non-HTML)
    assertEquals(result.value.pages > 0, true);
    assertEquals(result.value.fragments, fragFiles.length);
    assertEquals(result.value.errors.length, 0);
  }
});

Deno.test("StaticBuilder - generates OG images for posts", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  assertEquals(
    fileWriter.written.has("_site/images/og/test-post.svg"),
    true,
  );
});

Deno.test("StaticBuilder - generates well-known verification route", async () => {
  const fileWriter = createMockFileWriter();
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  // The .well-known path should be generated as a non-HTML route
  // Check it was written (path may vary based on implementation)
  const wellKnownWritten = [...fileWriter.written.keys()].some((k) =>
    k.includes("site.standard.publication")
  );
  assertEquals(wellKnownWritten, true);
});
