import { assertEquals } from "@std/assert";
import { createStaticBuilder } from "../../src/domain/static-builder.ts";
import type { ContentService } from "../../src/domain/content.ts";
import type { FileWriter } from "../../src/ports/writer.ts";
import type { Logger } from "../../src/ports/logger.ts";
import type { RouteHandlers } from "../../src/http/routes.tsx";
import type { RouteContext } from "../../src/http/types.ts";
import { err, ok } from "../../src/lib/result.ts";
import { createError } from "../../src/lib/error.ts";
import type {
  AppResult,
  Post,
  PostMeta,
  Slug,
  TagInfo,
  TagName,
} from "../../src/lib/types.ts";

// --- Mock helpers ---

function createMockFileWriter(
  publicFiles: Record<string, string> = {},
  failWriteFor?: string,
): FileWriter & {
  readonly written: Map<string, string>;
} {
  const written = new Map<string, string>();
  const missing = (path: string): AppResult<never> =>
    err(createError("IOError", `Not found: ${path}`, undefined, { path }));
  return {
    written,
    writeFile: async (
      path: string,
      content: string,
    ): Promise<AppResult<void>> => {
      if (path === failWriteFor) {
        return err(createError("IOError", `Failed to write file: ${path}`));
      }
      written.set(path, content);
      return ok(undefined);
    },
    ensureDir: async (): Promise<AppResult<void>> => ok(undefined),
    copyDir: async (_src: string, dest: string): Promise<AppResult<void>> => {
      for (const [relative, content] of Object.entries(publicFiles)) {
        written.set(`${dest}/${relative}`, content);
      }
      return ok(undefined);
    },
    clean: async (path: string): Promise<AppResult<void>> => {
      for (const key of [...written.keys()]) {
        if (key.startsWith(`${path}/`)) written.delete(key);
      }
      return ok(undefined);
    },
    listFiles: async (dir: string): Promise<AppResult<readonly string[]>> =>
      ok([...written.keys()].filter((key) => key.startsWith(`${dir}/`))),
    readBytes: async (path: string): Promise<AppResult<Uint8Array>> => {
      const content = written.get(path);
      return content === undefined
        ? missing(path)
        : ok(new TextEncoder().encode(content));
    },
    readText: async (path: string): Promise<AppResult<string>> => {
      const content = written.get(path);
      return content === undefined ? missing(path) : ok(content);
    },
    rename: async (from: string, to: string): Promise<AppResult<void>> => {
      const content = written.get(from);
      if (content === undefined) return missing(from);
      written.delete(from);
      written.set(to, content);
      return ok(undefined);
    },
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
    clearHtmlCache: () => {},
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
    // 11 fixed routes + 2 per post (page, OG image) + 1 per tag
    assertEquals(result.value.pages, 11 + 2 * 1 + 1);
    // 5 fixed HTML routes + 1 per post + 1 per tag
    assertEquals(result.value.fragments, 5 + 1 + 1);
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

Deno.test("StaticBuilder - fragment render request carries HX-Request-Type partial", async () => {
  const seen = new Map<string, Headers>();
  const routes = createMockRoutes();
  const recordingHome = (ctx: RouteContext) => {
    seen.set(ctx.pathname, ctx.req.headers);
    return new Response("<html><body>Page</body></html>");
  };
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: { ...routes, home: recordingHome },
    fileWriter: createMockFileWriter(),
    logger: createMockLogger(),
    publicDir: "public",
  });

  await builder.build({
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  });

  // home is rendered twice for "/": once as a page, once as a fragment
  assertEquals(seen.get("/")?.get("HX-Request"), "true");
  assertEquals(seen.get("/")?.get("HX-Request-Type"), "partial");
});

Deno.test("StaticBuilder - fingerprints assets and rewrites HTML references", async () => {
  const fileWriter = createMockFileWriter({
    "css/main.css": "body{color:red}",
    "static.html": '<link rel="stylesheet" href="/css/main.css">',
  });
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
  const keys = [...fileWriter.written.keys()];
  const fingerprinted = keys.find((k) =>
    /^_site\/css\/main\.[0-9a-f]{16}\.css$/.test(k)
  );
  assertEquals(fingerprinted !== undefined, true);
  assertEquals(fileWriter.written.has("_site/css/main.css"), false);

  const newName = (fingerprinted as string).substring("_site".length);
  assertEquals(
    fileWriter.written.get("_site/static.html"),
    `<link rel="stylesheet" href="${newName}">`,
  );
  const manifest = JSON.parse(
    fileWriter.written.get("_site/asset-manifest.json") ?? "{}",
  );
  assertEquals(manifest["/css/main.css"], newName);
});

Deno.test("StaticBuilder - building twice does not double-hash assets", async () => {
  const fileWriter = createMockFileWriter({
    "css/main.css": "body{color:red}",
  });
  const builder = createStaticBuilder({
    contentService: createMockContentService(),
    routes: createMockRoutes(),
    fileWriter,
    logger: createMockLogger(),
    publicDir: "public",
  });
  const options = {
    outputDir: "_site",
    baseUrl: "https://blog.example.com",
  };

  await builder.build(options);
  const first = [...fileWriter.written.keys()].sort();
  await builder.build(options);
  const second = [...fileWriter.written.keys()].sort();

  assertEquals(second, first);
});

Deno.test("StaticBuilder - a failed page write is reported with its route path", async () => {
  const fileWriter = createMockFileWriter({}, "_site/about/index.html");
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
    assertEquals(result.value.pages, 13);
    assertEquals(
      result.value.errors.some((e) => e.startsWith("/about")),
      true,
    );
  }
});
