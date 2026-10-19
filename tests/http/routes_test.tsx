import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { createRouteHandlers } from "../../src/http/routes.tsx";
import type { RouteContext } from "../../src/http/types.ts";
import type { ContentService } from "../../src/domain/content.ts";
import type { AnalyticsService } from "../../src/domain/analytics.ts";
import { err, ok } from "../../src/lib/result.ts";
import { createError } from "../../src/lib/error.ts";
import { createMemoryContentService } from "../helpers/content_service.ts";
import {
  createMemoryHealthService,
  type HealthDoubleOptions,
} from "../helpers/health_service.ts";
import type { AtProtoConfig } from "../../src/config/atproto.ts";
import type { SiteConfig } from "../../src/domain/config.ts";
import type { Post, Slug, TagName } from "../../src/lib/types.ts";

// --- Test doubles ---

const makePost = (title: string, slug: string): Post => ({
  title,
  date: "2025-01-15",
  slug: slug as Slug,
  content: "<p>Content</p>",
  excerpt: "An excerpt",
  tags: ["TypeScript" as TagName],
  formattedDate: "1/15/2025",
});

const POST = makePost("Test Post", "test-post");

const createContentService = (
  overrides: Partial<ContentService> = {},
): ContentService => createMemoryContentService([POST], overrides);

const createHealthService = createMemoryHealthService;
const healthService = createHealthService();

const analyticsService: AnalyticsService = {
  getViewCount: () => Promise.resolve(ok(0)),
  incrementViewCount: () => Promise.resolve(ok(1)),
  getAllViewCounts: () => Promise.resolve(ok({})),
  close: () => {},
};

const SITE: SiteConfig = {
  canonicalUrl: "https://blog.example",
  name: "Test Blog",
  twitterHandle: "@test",
};

const createHandlers = (
  contentService: ContentService = createContentService(),
  isProd = false,
) =>
  createRouteHandlers({
    contentService,
    healthService,
    analyticsService,
    atConfig: null,
    site: SITE,
    isProd,
  });

const AT_CONFIG: AtProtoConfig = {
  did: "did:plc:test",
  handle: "test.bsky.social",
  service: "https://bsky.social",
  appPassword: "test-password",
};

const failing = (): ContentService =>
  createMemoryContentService([POST], {
    loadPosts: () => Promise.resolve(err(createError("IOError", "disk"))),
    loadPostsMetadata: () =>
      Promise.resolve(err(createError("IOError", "disk"))),
    loadPostsMetadataWithViews: () =>
      Promise.resolve(err(createError("IOError", "disk"))),
    getPostBySlug: () => Promise.resolve(err(createError("IOError", "disk"))),
    getPostsByTag: () => Promise.resolve(err(createError("IOError", "disk"))),
    getTags: () => Promise.resolve(err(createError("IOError", "disk"))),
    searchPosts: () => Promise.resolve(err(createError("IOError", "disk"))),
  });

const contextFor = (
  path: string,
  headers: Record<string, string> = {},
): RouteContext => {
  const url = new URL(path, "http://localhost:8000");
  return {
    pathname: url.pathname,
    searchParams: url.searchParams,
    method: "GET",
    url,
    req: new Request(url.toString(), { headers }),
  };
};

const isFullPage = (body: string): boolean =>
  body.includes("<!DOCTYPE") || body.includes("<html");

// --- htmx 4 fragment rule ---

Deno.test("routes - HX-Request without HX-Request-Type returns a fragment", async () => {
  const handlers = createHandlers();
  const res = await handlers.home(contextFor("/", { "HX-Request": "true" }));
  assertEquals(isFullPage(await res.text()), false);
});

Deno.test("routes - HX-Request-Type partial returns a fragment", async () => {
  const handlers = createHandlers();
  const res = await handlers.home(
    contextFor("/", { "HX-Request": "true", "HX-Request-Type": "partial" }),
  );
  assertEquals(isFullPage(await res.text()), false);
});

Deno.test("routes - HX-Request-Type full returns the full page", async () => {
  const handlers = createHandlers();
  const res = await handlers.home(
    contextFor("/", { "HX-Request": "true", "HX-Request-Type": "full" }),
  );
  assertStringIncludes(await res.text(), "<html");
});

Deno.test("routes - history restore request returns the full page", async () => {
  const handlers = createHandlers();
  const res = await handlers.home(
    contextFor("/", {
      "HX-History-Restore-Request": "true",
      "HX-Request-Type": "full",
    }),
  );
  assertStringIncludes(await res.text(), "<html");
});

Deno.test("routes - Vary header names HX-Request-Type", async () => {
  const handlers = createHandlers();
  const fragment = await handlers.home(
    contextFor("/", { "HX-Request": "true" }),
  );
  assert(fragment.headers.get("Vary")?.includes("HX-Request-Type"));
  const page = await handlers.home(contextFor("/"));
  assert(page.headers.get("Vary")?.includes("HX-Request-Type"));
});

// --- search-modal escaping ---

Deno.test("routes - search-modal escapes the query when nothing matches", async () => {
  const handlers = createHandlers();
  const res = await handlers.searchModal(
    contextFor(
      `/search-modal?q=${encodeURIComponent("<img src=x onerror=alert(1)>")}`,
    ),
  );
  const body = await res.text();
  assertStringIncludes(body, "&lt;img");
  assertEquals(body.includes("<img"), false);
});

Deno.test("routes - search-modal escapes matching post titles", async () => {
  const evil = makePost("<script>x</script>", "evil-post");
  const handlers = createHandlers(
    createContentService({ searchPosts: () => Promise.resolve(ok([evil])) }),
  );
  const res = await handlers.searchModal(contextFor("/search-modal?q=x"));
  const body = await res.text();
  assertStringIncludes(body, "&lt;script&gt;");
  assertEquals(body.includes("<script>"), false);
});

// --- error pages ---

Deno.test("routes - home returns 500 when posts fail to load", async () => {
  const handlers = createHandlers(
    createContentService({
      loadPostsMetadataWithViews: () =>
        Promise.resolve(err(createError("IOError", "disk failure"))),
    }),
  );
  const res = await handlers.home(contextFor("/"));
  assertEquals(res.status, 500);
  assertStringIncludes(await res.text(), "Failed to load posts");
});

Deno.test("routes - production HTML cache skips error pages", async () => {
  let failing = true;
  const handlers = createHandlers(
    createContentService({
      loadPostsMetadataWithViews: () =>
        Promise.resolve(
          failing ? err(createError("IOError", "disk failure")) : ok([POST]),
        ),
    }),
    true,
  );

  const first = await handlers.home(contextFor("/"));
  assertEquals(first.status, 500);
  await first.text();

  failing = false;
  const second = await handlers.home(contextFor("/"));
  assertEquals(second.status, 200);
  assertEquals(second.headers.get("X-Cache") === "HIT", false);
  assertStringIncludes(await second.text(), "Test Post");
});

Deno.test("routes - tagPosts returns 400 for an invalid tag name", async () => {
  const handlers = createHandlers();
  const res = await handlers.tagPosts(contextFor("/tags/"));
  assertEquals(res.status, 400);
});

// --- characterization: status, content type, body markers ---

const HTML = "text/html; charset=utf-8";
const PLAIN_UTF8 = "text/plain;charset=UTF-8";

const textOf = async (res: Response | Promise<Response>) => {
  const response = await res;
  return {
    status: response.status,
    type: response.headers.get("Content-Type"),
    body: await response.text(),
  };
};

Deno.test("routes - home renders the full page with post titles and layout metadata", async () => {
  const handlers = createHandlers();
  const { status, type, body } = await textOf(handlers.home(contextFor("/")));
  assertEquals(status, 200);
  assertEquals(type, HTML);
  assertStringIncludes(body, "Test Post");
  assertStringIncludes(body, "<title>Blog - Home</title>");
  assertStringIncludes(
    body,
    '<link rel="canonical" href="http://localhost:8000/">',
  );
  assertStringIncludes(body, '"@type":"Blog"');
  assertStringIncludes(body, '<script src="/js/htmx.min.js" defer>');
  assertStringIncludes(body, 'property="og:title" content="Blog - Home"');
});

Deno.test("routes - home partial is a fragment of the latest posts", async () => {
  const handlers = createHandlers();
  const { body } = await textOf(
    handlers.home(contextFor("/", { "HX-Request": "true" })),
  );
  assertEquals(body.startsWith('<section aria-label="Latest posts">'), true);
  assertStringIncludes(body, "Test Post");
});

Deno.test("routes - about renders the about page", async () => {
  const { status, type, body } = await textOf(
    createHandlers().about(contextFor("/about")),
  );
  assertEquals(status, 200);
  assertEquals(type, HTML);
  assertStringIncludes(body, "Hi, I&#39;m Srdjan");
});

Deno.test("routes - post renders the post page with layout metadata", async () => {
  const handlers = createHandlers();
  const { status, type, body } = await textOf(
    handlers.post(contextFor("/posts/test-post")),
  );
  assertEquals(status, 200);
  assertEquals(type, HTML);
  assertStringIncludes(body, "<title>Test Post - Blog</title>");
  assertStringIncludes(
    body,
    '<link rel="canonical" href="http://localhost:8000/posts/test-post">',
  );
  assertStringIncludes(body, 'og:title" content="Test Post - Blog"');
  assertStringIncludes(body, '"@type":"BlogPosting"');
  assertStringIncludes(body, "<p>Content</p>");
  assertStringIncludes(body, '<script src="/js/htmx.min.js" defer>');
  assertEquals(body.includes("site.standard.document"), false);
});

Deno.test("routes - post links the AT Protocol document when configured", async () => {
  const handlers = createRouteHandlers({
    contentService: createContentService(),
    healthService,
    analyticsService,
    atConfig: AT_CONFIG,
    site: SITE,
    isProd: false,
  });
  const { body } = await textOf(handlers.post(contextFor("/posts/test-post")));
  assertStringIncludes(
    body,
    'rel="site.standard.document" href="at://did:plc:test/site.standard.document/test-post"',
  );
});

Deno.test("routes - post returns 404 for an unknown slug", async () => {
  const handlers = createHandlers(
    createContentService({ getPostBySlug: () => Promise.resolve(ok(null)) }),
  );
  assertEquals(
    await textOf(handlers.post(contextFor("/posts/missing"))),
    { status: 404, type: PLAIN_UTF8, body: "Post not found" },
  );
});

Deno.test("routes - post returns 500 when the content service fails", async () => {
  assertEquals(
    await textOf(createHandlers(failing()).post(contextFor("/posts/x"))),
    { status: 500, type: PLAIN_UTF8, body: "Failed to load post" },
  );
});

Deno.test("routes - post increments the view count once", async () => {
  const incremented: string[] = [];
  const recording: AnalyticsService = {
    ...analyticsService,
    incrementViewCount: (slug) => {
      incremented.push(slug);
      return Promise.resolve(ok(1));
    },
  };
  const handlers = createRouteHandlers({
    contentService: createContentService(),
    healthService,
    analyticsService: recording,
    atConfig: null,
    site: SITE,
    isProd: false,
  });
  await textOf(handlers.post(contextFor("/posts/test-post")));
  assertEquals(incremented, ["test-post"]);
});

Deno.test("routes - tags renders topic groups", async () => {
  const handlers = createHandlers();
  const { status, type, body } = await textOf(
    handlers.tags(contextFor("/tags")),
  );
  assertEquals(status, 200);
  assertEquals(type, HTML);
  assertStringIncludes(body, "Topics &amp; Tags");
});

Deno.test("routes - tags returns a 500 page when tags fail to load", async () => {
  const { status, type, body } = await textOf(
    createHandlers(failing()).tags(contextFor("/tags")),
  );
  assertEquals(status, 500);
  assertEquals(type, HTML);
  assertStringIncludes(body, "Failed to load tags");
});

Deno.test("routes - tagPosts lists the posts of a known tag", async () => {
  const { status, body } = await textOf(
    createHandlers().tagPosts(contextFor("/tags/TypeScript")),
  );
  assertEquals(status, 200);
  assertStringIncludes(body, "Test Post");
});

Deno.test("routes - tagPosts gives an empty 200 page for an unknown valid tag", async () => {
  const { status, body } = await textOf(
    createHandlers().tagPosts(contextFor("/tags/Nothing")),
  );
  assertEquals(status, 200);
  assertStringIncludes(body, "No posts found.");
});

Deno.test("routes - tagPosts returns a 500 page when posts fail to load", async () => {
  const { status, body } = await textOf(
    createHandlers(failing()).tagPosts(contextFor("/tags/TypeScript")),
  );
  assertEquals(status, 500);
  assertStringIncludes(body, "Failed to load posts for tag");
});

Deno.test("routes - search lists matching posts", async () => {
  const { status, type, body } = await textOf(
    createHandlers().search(contextFor("/search?q=Test")),
  );
  assertEquals(status, 200);
  assertEquals(type, HTML);
  assertStringIncludes(body, "Test Post");
  assertStringIncludes(body, 'name="robots" content="noindex, nofollow"');
});

Deno.test("routes - search without q asks for a query", async () => {
  const { status, body } = await textOf(
    createHandlers().search(contextFor("/search")),
  );
  assertEquals(status, 200);
  assertStringIncludes(body, "Please provide a search query.");
  assertStringIncludes(body, 'name="robots" content="noindex, nofollow"');
});

Deno.test("routes - search returns a 500 page when the search fails", async () => {
  const { status, body } = await textOf(
    createHandlers(failing()).search(contextFor("/search?q=x")),
  );
  assertEquals(status, 500);
  assertStringIncludes(body, "Failed to search posts");
});

Deno.test("routes - searchModal returns 400 without q", async () => {
  assertEquals(
    await textOf(createHandlers().searchModal(contextFor("/search-modal"))),
    {
      status: 400,
      type: "text/plain; charset=utf-8",
      body: "Missing query parameter",
    },
  );
});

Deno.test("routes - searchModal returns 500 when the search fails", async () => {
  assertEquals(
    await textOf(
      createHandlers(failing()).searchModal(contextFor("/search-modal?q=x")),
    ),
    { status: 500, type: "text/plain; charset=utf-8", body: "Search failed" },
  );
});

Deno.test("routes - rssPage renders the subscription page", async () => {
  const { status, body } = await textOf(
    createHandlers().rssPage(contextFor("/rss")),
  );
  assertEquals(status, 200);
  assertStringIncludes(body, "<h1>RSS Subscriptions</h1>");
});

Deno.test("routes - rssPage returns a 500 page when posts fail to load", async () => {
  const { status } = await textOf(
    createHandlers(failing()).rssPage(contextFor("/rss")),
  );
  assertEquals(status, 500);
});

Deno.test("routes - rss returns the feed", async () => {
  const { status, type, body } = await textOf(
    createHandlers().rss(contextFor("/rss.xml")),
  );
  assertEquals(status, 200);
  assertEquals(type, "application/rss+xml; charset=utf-8");
  assertStringIncludes(body, '<rss version="2.0"');
});

Deno.test("routes - rss returns 500 when posts fail to load", async () => {
  const { status, body } = await textOf(
    createHandlers(failing()).rss(contextFor("/rss.xml")),
  );
  assertEquals(status, 500);
  assertEquals(body, "Failed to generate RSS");
});

Deno.test("routes - rssByTopic returns the feed of a known topic", async () => {
  const { status, type, body } = await textOf(
    createHandlers().rssByTopic(contextFor("/rss/topic/languages-runtimes")),
  );
  assertEquals(status, 200);
  assertEquals(type, "application/rss+xml; charset=utf-8");
  assertStringIncludes(body, "<title>Languages &amp; Runtimes</title>");
});

Deno.test("routes - rssByTopic returns 404 for an unknown topic", async () => {
  const { status, body } = await textOf(
    createHandlers().rssByTopic(contextFor("/rss/topic/nope")),
  );
  assertEquals(status, 404);
  assertEquals(body, "Topic not found");
});

Deno.test("routes - rssByTopic returns 500 when posts fail to load", async () => {
  const { status } = await textOf(
    createHandlers(failing()).rssByTopic(
      contextFor("/rss/topic/languages-runtimes"),
    ),
  );
  assertEquals(status, 500);
});

Deno.test("routes - sitemap returns the urlset", async () => {
  const { status, type, body } = await textOf(
    createHandlers().sitemap(contextFor("/sitemap.xml")),
  );
  assertEquals(status, 200);
  assertEquals(type, "application/xml; charset=utf-8");
  assertStringIncludes(body, "<urlset");
});

Deno.test("routes - sitemap returns 500 when posts fail to load", async () => {
  const { status } = await textOf(
    createHandlers(failing()).sitemap(contextFor("/sitemap.xml")),
  );
  assertEquals(status, 500);
});

Deno.test("routes - robots returns the robots file", async () => {
  const { status, type, body } = await textOf(
    createHandlers().robots(contextFor("/robots.txt")),
  );
  assertEquals(status, 200);
  assertEquals(type, "text/plain; charset=utf-8");
  assertStringIncludes(body, "User-agent: *");
});

Deno.test("routes - ogImageDefault returns the default SVG", async () => {
  const { status, type, body } = await textOf(
    createHandlers().ogImageDefault(contextFor("/images/og-default.svg")),
  );
  assertEquals(status, 200);
  assertEquals(type, "image/svg+xml");
  assertStringIncludes(body, '<svg width="1200"');
});

Deno.test("routes - ogImagePost returns an SVG with the post title", async () => {
  const { status, type, body } = await textOf(
    createHandlers().ogImagePost(contextFor("/images/og/test-post.svg")),
  );
  assertEquals(status, 200);
  assertEquals(type, "image/svg+xml");
  assertStringIncludes(body, '<svg width="1200"');
  assertStringIncludes(body, "Test Post");
});

Deno.test("routes - ogImagePost returns 404 for an unknown slug", async () => {
  const handlers = createHandlers(
    createContentService({ getPostBySlug: () => Promise.resolve(ok(null)) }),
  );
  const { status, body } = await textOf(
    handlers.ogImagePost(contextFor("/images/og/missing.svg")),
  );
  // Fixed: plan finding B9
  assertEquals(status, 404);
  assertEquals(body, "Not Found");
});

Deno.test("routes - ogImagePost returns 500 on a content error", async () => {
  const { status, body } = await textOf(
    createHandlers(failing()).ogImagePost(contextFor("/images/og/x.svg")),
  );
  // Fixed: plan finding B9
  assertEquals(status, 500);
  assertEquals(body, "Failed to generate OG image");
});

const healthCases: ReadonlyArray<
  readonly [string, HealthDoubleOptions, number]
> = [
  ["healthy", { status: "healthy" }, 200],
  ["degraded", { status: "degraded" }, 200],
  ["unhealthy", { status: "unhealthy" }, 503],
];

for (const [name, options, expected] of healthCases) {
  Deno.test(`routes - health returns ${expected} when ${name}`, async () => {
    const handlers = createRouteHandlers({
      contentService: createContentService(),
      healthService: createHealthService(options),
      analyticsService,
      atConfig: null,
      site: SITE,
      isProd: false,
    });
    const { status, type, body } = await textOf(
      handlers.health(contextFor("/health")),
    );
    assertEquals(status, expected);
    assertEquals(type, "application/json; charset=utf-8");
    assertStringIncludes(body, `"status": "${options.status}"`);
  });
}

Deno.test("routes - health returns 503 when the check itself fails", async () => {
  const handlers = createRouteHandlers({
    contentService: createContentService(),
    healthService: createHealthService({ failWith: "probe failed" }),
    analyticsService,
    atConfig: null,
    site: SITE,
    isProd: false,
  });
  const { status, body } = await textOf(handlers.health(contextFor("/health")));
  assertEquals(status, 503);
  assertStringIncludes(body, '"status": "unhealthy"');
  assertStringIncludes(body, "probe failed");
});

Deno.test("routes - atprotoVerification returns 404 without config", async () => {
  assertEquals(
    await textOf(
      createHandlers().atprotoVerification(
        contextFor("/.well-known/site.standard.publication"),
      ),
    ),
    { status: 404, type: PLAIN_UTF8, body: "Not Found" },
  );
});

Deno.test("routes - atprotoVerification returns the publication URI with config", async () => {
  const handlers = createRouteHandlers({
    contentService: createContentService(),
    healthService,
    analyticsService,
    atConfig: AT_CONFIG,
    site: SITE,
    isProd: false,
  });
  const { status, body } = await textOf(
    handlers.atprotoVerification(
      contextFor("/.well-known/site.standard.publication"),
    ),
  );
  assertEquals(status, 200);
  assertEquals(body, "at://did:plc:test/site.standard.publication/self");
});
