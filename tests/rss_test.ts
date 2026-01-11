import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { generateRSS, generateTopicRssFeed } from "../src/rss.ts";
import type { Post, Slug, TagName } from "../src/lib/types.ts";

// Helper to create test posts
const createPost = (
  slug: string,
  title: string,
  date: string,
  tags: string[] = [],
  excerpt?: string,
  content = "This is test content for the post.",
): Post => {
  const post: Post = {
    slug: slug as Slug,
    title,
    date,
    content,
    tags: tags as unknown as TagName[],
  };

  if (excerpt !== undefined) {
    return { ...post, excerpt };
  }

  return post;
};

Deno.test("generateRSS - generates valid RSS structure", () => {
  const posts = [createPost("test-post", "Test Post", "2025-01-01")];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should have proper XML declaration
  assertStringIncludes(rss, '<?xml version="1.0" encoding="UTF-8"?>');

  // Should have proper RSS structure
  assertStringIncludes(
    rss,
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  );
  assertStringIncludes(rss, "<channel>");
  assertStringIncludes(rss, "</channel>");
  assertStringIncludes(rss, "</rss>");
});

Deno.test("generateRSS - includes feed metadata", () => {
  const posts = [createPost("test-post", "Test Post", "2025-01-01")];
  const rss = generateRSS(
    posts,
    "My Blog",
    "https://example.com",
    "A test blog",
  );

  // Should include title
  assertStringIncludes(rss, "<title>My Blog</title>");

  // Should include link
  assertStringIncludes(rss, "<link>https://example.com</link>");

  // Should include description
  assertStringIncludes(rss, "<description>A test blog</description>");

  // Should include language
  assertStringIncludes(rss, "<language>en-us</language>");

  // Should include lastBuildDate
  assertStringIncludes(rss, "<lastBuildDate>");

  // Should include atom:link self-reference
  assertStringIncludes(rss, 'atom:link href="https://example.com/feed.xml"');
  assertStringIncludes(rss, 'rel="self"');
  assertStringIncludes(rss, 'type="application/rss+xml"');
});

Deno.test("generateRSS - uses default description when not provided", () => {
  const posts = [createPost("test-post", "Test Post", "2025-01-01")];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should use default description format
  assertStringIncludes(
    rss,
    "<description>My Blog - Latest posts</description>",
  );
});

Deno.test("generateRSS - includes post items", () => {
  const posts = [
    createPost("post-1", "First Post", "2025-01-01"),
    createPost("post-2", "Second Post", "2025-01-02"),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should include item elements
  assertStringIncludes(rss, "<item>");
  assertStringIncludes(rss, "</item>");

  // Should include post titles
  assertStringIncludes(rss, "<title>First Post</title>");
  assertStringIncludes(rss, "<title>Second Post</title>");

  // Should include post links
  assertStringIncludes(rss, "<link>https://example.com/posts/post-1</link>");
  assertStringIncludes(rss, "<link>https://example.com/posts/post-2</link>");

  // Should include GUIDs
  assertStringIncludes(rss, "<guid>https://example.com/posts/post-1</guid>");
  assertStringIncludes(rss, "<guid>https://example.com/posts/post-2</guid>");

  // Should include pubDate
  assertStringIncludes(rss, "<pubDate>");
});

Deno.test("generateRSS - uses excerpt as description when available", () => {
  const posts = [
    createPost(
      "post-1",
      "Test Post",
      "2025-01-01",
      [],
      "This is a custom excerpt",
    ),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should use the excerpt
  assertStringIncludes(
    rss,
    "<description>This is a custom excerpt</description>",
  );
});

Deno.test("generateRSS - generates description from content when no excerpt", () => {
  const longContent =
    "This is a very long content that should be truncated to 200 characters. "
      .repeat(5);
  const posts = [
    createPost("post-1", "Test Post", "2025-01-01", [], undefined, longContent),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should include truncated description with ellipsis
  assertStringIncludes(rss, "<description>");
  assertStringIncludes(rss, "...</description>");
});

Deno.test("generateRSS - strips HTML from content description", () => {
  const htmlContent =
    "<p>This is <strong>HTML</strong> content with <a href='/test'>links</a>.</p>";
  const posts = [
    createPost("post-1", "Test Post", "2025-01-01", [], undefined, htmlContent),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should strip HTML tags
  assertStringIncludes(rss, "This is HTML content with links");
  assertEquals(rss.includes("<p>"), false);
  assertEquals(rss.includes("<strong>"), false);
  assertEquals(rss.includes("<a href"), false);
});

Deno.test("generateRSS - includes post tags as categories", () => {
  const posts = [
    createPost("post-1", "Test Post", "2025-01-01", [
      "TypeScript",
      "Deno",
      "WebDev",
    ]),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should include category elements
  assertStringIncludes(rss, "<category>TypeScript</category>");
  assertStringIncludes(rss, "<category>Deno</category>");
  assertStringIncludes(rss, "<category>WebDev</category>");
});

Deno.test("generateRSS - handles posts without tags", () => {
  const posts = [
    createPost("post-1", "Test Post", "2025-01-01", []),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should not include category elements
  const categoryCount = (rss.match(/<category>/g) || []).length;
  assertEquals(categoryCount, 0);
});

Deno.test("generateRSS - escapes XML special characters in title", () => {
  const posts = [
    createPost("post-1", 'Post with <special> & "characters"', "2025-01-01"),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should escape XML entities
  assertStringIncludes(rss, "&lt;special&gt;");
  assertStringIncludes(rss, "&amp;");
  assertStringIncludes(rss, "&quot;");

  // Should not include unescaped characters
  assertEquals(rss.includes("<special>"), false);
});

Deno.test("generateRSS - escapes XML special characters in tags", () => {
  const posts = [
    createPost("post-1", "Test Post", "2025-01-01", ["C++", "React&Redux"]),
  ];
  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should escape XML entities in categories
  assertStringIncludes(rss, "<category>C++</category>");
  assertStringIncludes(rss, "<category>React&amp;Redux</category>");
});

Deno.test("generateRSS - limits to 20 most recent posts", () => {
  // Create 25 posts
  const posts = Array.from(
    { length: 25 },
    (_, i) =>
      createPost(
        `post-${i}`,
        `Post ${i}`,
        `2025-01-${String(i + 1).padStart(2, "0")}`,
      ),
  );

  const rss = generateRSS(posts, "My Blog", "https://example.com");

  // Should include first 20 posts
  for (let i = 0; i < 20; i++) {
    assertStringIncludes(rss, `<title>Post ${i}</title>`);
  }

  // Should not include posts 20-24
  for (let i = 20; i < 25; i++) {
    assertEquals(rss.includes(`<title>Post ${i}</title>`), false);
  }
});

Deno.test("generateRSS - handles empty posts array", () => {
  const rss = generateRSS([], "My Blog", "https://example.com");

  // Should still have valid RSS structure
  assertStringIncludes(rss, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(rss, "<channel>");
  assertStringIncludes(rss, "</channel>");

  // Should not have any items
  assertEquals(rss.includes("<item>"), false);
});

Deno.test("generateTopicRssFeed - generates valid RSS structure", () => {
  const posts = [createPost("test-post", "Test Post", "2025-01-01")];
  const rss = generateTopicRssFeed(
    posts,
    "Web Development",
    "https://example.com",
    "/rss/topic/web-development",
  );

  // Should have proper XML and RSS structure
  assertStringIncludes(rss, '<?xml version="1.0" encoding="UTF-8"?>');
  assertStringIncludes(rss, '<rss version="2.0"');
  assertStringIncludes(rss, "<channel>");
  assertStringIncludes(rss, "</channel>");
  assertStringIncludes(rss, "</rss>");
});

Deno.test("generateTopicRssFeed - includes topic-specific metadata", () => {
  const posts = [createPost("test-post", "Test Post", "2025-01-01")];
  const rss = generateTopicRssFeed(
    posts,
    "TypeScript Tips",
    "https://example.com",
    "/rss/topic/typescript",
    "TypeScript programming tips",
  );

  // Should include topic title
  assertStringIncludes(rss, "<title>TypeScript Tips</title>");

  // Should include custom description
  assertStringIncludes(
    rss,
    "<description>TypeScript programming tips</description>",
  );

  // Should use self path for atom:link
  assertStringIncludes(
    rss,
    'atom:link href="https://example.com/rss/topic/typescript"',
  );
});

Deno.test("generateTopicRssFeed - uses default description format", () => {
  const posts = [createPost("test-post", "Test Post", "2025-01-01")];
  const rss = generateTopicRssFeed(
    posts,
    "TypeScript",
    "https://example.com",
    "/rss/topic/typescript",
  );

  // Should use default description
  assertStringIncludes(
    rss,
    "<description>TypeScript - Latest posts</description>",
  );
});

Deno.test("generateTopicRssFeed - includes post items like generateRSS", () => {
  const posts = [
    createPost("post-1", "First Post", "2025-01-01", ["TypeScript"]),
    createPost("post-2", "Second Post", "2025-01-02", ["TypeScript", "Deno"]),
  ];
  const rss = generateTopicRssFeed(
    posts,
    "TypeScript",
    "https://example.com",
    "/rss/topic/typescript",
  );

  // Should include items
  assertStringIncludes(rss, "<item>");

  // Should include post data
  assertStringIncludes(rss, "<title>First Post</title>");
  assertStringIncludes(rss, "<link>https://example.com/posts/post-1</link>");
  assertStringIncludes(rss, "<guid>https://example.com/posts/post-1</guid>");

  // Should include categories
  assertStringIncludes(rss, "<category>TypeScript</category>");
  assertStringIncludes(rss, "<category>Deno</category>");
});

Deno.test("generateTopicRssFeed - limits to 20 posts", () => {
  const posts = Array.from(
    { length: 25 },
    (_, i) => createPost(`post-${i}`, `Post ${i}`, `2025-01-01`),
  );

  const rss = generateTopicRssFeed(
    posts,
    "TypeScript",
    "https://example.com",
    "/rss/topic/typescript",
  );

  // Should only include 20 posts
  for (let i = 0; i < 20; i++) {
    assertStringIncludes(rss, `<title>Post ${i}</title>`);
  }

  for (let i = 20; i < 25; i++) {
    assertEquals(rss.includes(`<title>Post ${i}</title>`), false);
  }
});

Deno.test("generateTopicRssFeed - handles empty posts array", () => {
  const rss = generateTopicRssFeed(
    [],
    "TypeScript",
    "https://example.com",
    "/rss/topic/typescript",
  );

  // Should have valid structure
  assertStringIncludes(rss, "<channel>");
  assertStringIncludes(rss, "<title>TypeScript</title>");

  // Should not have items
  assertEquals(rss.includes("<item>"), false);
});
