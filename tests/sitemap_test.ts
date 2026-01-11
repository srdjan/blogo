import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { generateRobotsTxt, generateSitemap } from "../src/sitemap.ts";
import type { Post, Slug, TagName } from "../src/lib/types.ts";

// Helper to create test posts
const createPost = (
  slug: string,
  tags: string[] = [],
  date = "2025-01-01",
  modified?: string,
): Post => ({
  slug: slug as Slug,
  title: `Test Post ${slug}`,
  date,
  modified,
  excerpt: "Test excerpt",
  content: "Test content",
  tags: tags as unknown as TagName[],
  draft: false,
});

Deno.test("generateSitemap - only includes post URLs", () => {
  const sitemap = generateSitemap([], "https://example.com");

  // Should not include non-post pages
  assertEquals(sitemap.includes("<loc>https://example.com/</loc>"), false);
  assertEquals(sitemap.includes("<loc>https://example.com/about</loc>"), false);
  assertEquals(sitemap.includes("<loc>https://example.com/tags</loc>"), false);
  assertEquals(sitemap.includes("<loc>https://example.com/rss</loc>"), false);
});

Deno.test("generateSitemap - includes post pages", () => {
  const posts = [
    createPost("test-post-1"),
    createPost("test-post-2"),
  ];

  const sitemap = generateSitemap(posts, "https://example.com");

  assertStringIncludes(
    sitemap,
    "<loc>https://example.com/posts/test-post-1</loc>",
  );
  assertStringIncludes(
    sitemap,
    "<loc>https://example.com/posts/test-post-2</loc>",
  );
});

Deno.test("generateSitemap - uses modified date when available", () => {
  const posts = [
    createPost("post-1", [], "2025-01-01", "2025-01-15"),
  ];

  const sitemap = generateSitemap(posts, "https://example.com");

  // Should use modified date instead of original date
  assertStringIncludes(sitemap, "<lastmod>2025-01-15T");
});

Deno.test("generateSitemap - uses date when no modified date", () => {
  const posts = [
    createPost("post-1", [], "2025-01-01"),
  ];

  const sitemap = generateSitemap(posts, "https://example.com");

  // Should use original date
  assertStringIncludes(sitemap, "<lastmod>2025-01-01T");
});

Deno.test("generateSitemap - sets correct priorities", () => {
  const posts = [
    createPost("post-1", ["TypeScript"]),
  ];

  const sitemap = generateSitemap(posts, "https://example.com");

  // Posts: 0.9
  const postPriority = sitemap.match(
    /<loc>https:\/\/example\.com\/posts\/post-1<\/loc>[\s\S]*?<priority>([\d.]+)<\/priority>/,
  );
  assertEquals(postPriority?.[1], "0.9");
});

Deno.test("generateSitemap - sets correct change frequencies", () => {
  const posts = [
    createPost("post-1", ["TypeScript"]),
  ];

  const sitemap = generateSitemap(posts, "https://example.com");

  // Posts: monthly
  const postFreq = sitemap.match(
    /<loc>https:\/\/example\.com\/posts\/post-1<\/loc>[\s\S]*?<changefreq>(\w+)<\/changefreq>/,
  );
  assertEquals(postFreq?.[1], "monthly");
});

Deno.test("generateSitemap - generates valid XML structure", () => {
  const posts = [createPost("test-post")];
  const sitemap = generateSitemap(posts, "https://example.com");

  // Should have proper XML declaration
  assertStringIncludes(sitemap, '<?xml version="1.0" encoding="UTF-8"?>');

  // Should have proper urlset namespace
  assertStringIncludes(
    sitemap,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  );
  assertStringIncludes(sitemap, "</urlset>");

  // Should have url entries
  assertStringIncludes(sitemap, "<url>");
  assertStringIncludes(sitemap, "</url>");
  assertStringIncludes(sitemap, "<loc>");
  assertStringIncludes(sitemap, "<lastmod>");
  assertStringIncludes(sitemap, "<changefreq>");
  assertStringIncludes(sitemap, "<priority>");
});

Deno.test("generateSitemap - handles posts without tags", () => {
  const posts = [
    createPost("post-1", []),
    createPost("post-2"),
  ];

  const sitemap = generateSitemap(posts, "https://example.com");

  // Should include posts
  assertStringIncludes(sitemap, "<loc>https://example.com/posts/post-1</loc>");
  assertStringIncludes(sitemap, "<loc>https://example.com/posts/post-2</loc>");

  // Should not include tag pages
  assertEquals(sitemap.includes("<loc>https://example.com/tags"), false);
});

Deno.test("generateSitemap - handles empty posts array", () => {
  const sitemap = generateSitemap([], "https://example.com");

  // Should have no <url> entries
  assertEquals(sitemap.includes("<url>"), false);

  // Should be valid XML
  assertStringIncludes(sitemap, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(sitemap, "</urlset>");
});

Deno.test("generateRobotsTxt - generates valid robots.txt", () => {
  const robotsTxt = generateRobotsTxt("https://example.com");

  // Should have user-agent
  assertStringIncludes(robotsTxt, "User-agent: *");
  assertStringIncludes(robotsTxt, "Allow: /");

  // Should have sitemap
  assertStringIncludes(robotsTxt, "Sitemap: https://example.com/sitemap.xml");

  // Should have host
  assertStringIncludes(robotsTxt, "Host: https://example.com");

  // Should have crawl delay
  assertStringIncludes(robotsTxt, "Crawl-delay: 1");

  // Should block dev paths
  assertStringIncludes(robotsTxt, "Disallow: /dev/");
  assertStringIncludes(robotsTxt, "Disallow: /test/");
  assertStringIncludes(robotsTxt, "Disallow: /_/");
});

Deno.test("generateRobotsTxt - uses provided base URL", () => {
  const robotsTxt = generateRobotsTxt("https://myblog.com");

  assertStringIncludes(robotsTxt, "Sitemap: https://myblog.com/sitemap.xml");
  assertStringIncludes(robotsTxt, "Host: https://myblog.com");
});
