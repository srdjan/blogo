import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { createRouteHandlers } from "../../src/http/routes.tsx";
import type { RouteContext } from "../../src/http/types.ts";
import type { ContentService } from "../../src/domain/content.ts";
import type { HealthService } from "../../src/domain/health.ts";
import type { AnalyticsService } from "../../src/domain/analytics.ts";
import { ok } from "../../src/lib/result.ts";
import type { Post, PostMeta, Slug, TagName } from "../../src/lib/types.ts";

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
): ContentService => ({
  loadPosts: async () => ok([POST]),
  loadPostsMetadata: async () => ok([POST as PostMeta]),
  loadPostsMetadataWithViews: async () => ok([POST]),
  loadPostsWithViews: async () => ok([POST]),
  getPostBySlug: async () => ok(POST),
  getPostsByTag: async () => ok([POST]),
  getTags: async () => ok([]),
  searchPosts: async () => ok([]),
  ...overrides,
});

const healthService = {} as HealthService;

const analyticsService: AnalyticsService = {
  getViewCount: async () => ok(0),
  incrementViewCount: async () => ok(1),
  getAllViewCounts: async () => ok({}),
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
