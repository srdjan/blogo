import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { createRouteHandlers } from "../../src/http/routes.tsx";
import type { RouteContext } from "../../src/http/types.ts";
import type { ContentService } from "../../src/domain/content.ts";
import type { HealthService } from "../../src/domain/health.ts";
import type { AnalyticsService } from "../../src/domain/analytics.ts";
import { err, ok } from "../../src/lib/result.ts";
import { createError } from "../../src/lib/error.ts";
import { createMemoryContentService } from "../helpers/content_service.ts";
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

const healthService = {} as HealthService;

const analyticsService: AnalyticsService = {
  getViewCount: () => Promise.resolve(ok(0)),
  incrementViewCount: () => Promise.resolve(ok(1)),
  getAllViewCounts: () => Promise.resolve(ok({})),
  close: () => {},
};

const createHandlers = (
  contentService: ContentService = createContentService(),
) => createRouteHandlers(contentService, healthService, analyticsService, null);

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
  const previous = Deno.env.get("DENO_ENV");
  Deno.env.set("DENO_ENV", "production");
  try {
    let failing = true;
    const handlers = createHandlers(
      createContentService({
        loadPostsMetadataWithViews: () =>
          Promise.resolve(
            failing ? err(createError("IOError", "disk failure")) : ok([POST]),
          ),
      }),
    );

    const first = await handlers.home(contextFor("/"));
    assertEquals(first.status, 500);
    await first.text();

    failing = false;
    const second = await handlers.home(contextFor("/"));
    assertEquals(second.status, 200);
    assertEquals(second.headers.get("X-Cache") === "HIT", false);
    assertStringIncludes(await second.text(), "Test Post");
  } finally {
    if (previous === undefined) Deno.env.delete("DENO_ENV");
    else Deno.env.set("DENO_ENV", previous);
  }
});

Deno.test("routes - tagPosts returns 400 for an invalid tag name", async () => {
  const handlers = createHandlers();
  const res = await handlers.tagPosts(contextFor("/tags/"));
  assertEquals(res.status, 400);
});
