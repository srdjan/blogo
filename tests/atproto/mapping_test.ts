import { assertEquals } from "@std/assert";
import {
  documentToMarkdown,
  postToDocument,
  slugToRkey,
} from "../../src/atproto/mapping.ts";
import type { Post, Slug, TagName } from "../../src/lib/types.ts";
import type { StandardDocument } from "../../src/atproto/types.ts";

const makePost = (overrides?: Partial<Post>): Post => ({
  title: "Test Post",
  date: "2025-01-15",
  slug: "test-post" as Slug,
  content: "<h1>Test</h1>",
  excerpt: "A test post",
  tags: ["TypeScript" as TagName, "Deno" as TagName],
  ...overrides,
});

const PUBLICATION_URI = "at://did:plc:abc123/site.standard.publication/self";
const PUBLIC_URL = "https://blog.example.com";

Deno.test("slugToRkey - strips non-alphanumeric/hyphen characters", () => {
  assertEquals(slugToRkey("test-post" as Slug), "test-post");
  assertEquals(slugToRkey("hello_world" as Slug), "helloworld");
  assertEquals(slugToRkey("my.post.slug" as Slug), "mypostslug");
});

Deno.test("postToDocument - maps all fields correctly", () => {
  const post = makePost();
  const rawMarkdown = "# Test\n\nSome content here.";

  const doc = postToDocument({
    post,
    rawMarkdown,
    publicationUri: PUBLICATION_URI,
    publicUrl: PUBLIC_URL,
  });

  assertEquals(doc.$type, "site.standard.document");
  assertEquals(doc.site, PUBLICATION_URI);
  assertEquals(doc.title, "Test Post");
  assertEquals(doc.publishedAt, "2025-01-15T00:00:00.000Z");
  assertEquals(doc.path, "/posts/test-post");
  assertEquals(doc.description, "A test post");
  assertEquals(doc.tags, ["TypeScript", "Deno"]);
  assertEquals(doc.content?.$type, "site.standard.content.markdown");
  assertEquals(
    (doc.content as { value: string }).value,
    "# Test\n\nSome content here.",
  );
});

Deno.test("postToDocument - handles missing optional fields", () => {
  const post: Post = {
    title: "Minimal Post",
    date: "2025-01-15",
    slug: "minimal" as Slug,
    content: "<p>Hi</p>",
  };
  const rawMarkdown = "# Test";

  const doc = postToDocument({
    post,
    rawMarkdown,
    publicationUri: PUBLICATION_URI,
    publicUrl: PUBLIC_URL,
  });

  assertEquals(doc.description, undefined);
  assertEquals(doc.tags, undefined);
  assertEquals(doc.updatedAt, undefined);
});

Deno.test("postToDocument - includes updatedAt from modified field", () => {
  const post = makePost({ modified: "2025-02-01" });
  const rawMarkdown = "# Test";

  const doc = postToDocument({
    post,
    rawMarkdown,
    publicationUri: PUBLICATION_URI,
    publicUrl: PUBLIC_URL,
  });

  assertEquals(doc.updatedAt, "2025-02-01T00:00:00.000Z");
});

Deno.test("postToDocument - truncates textContent at 10000 chars", () => {
  const post = makePost();
  const rawMarkdown = "x".repeat(20000);

  const doc = postToDocument({
    post,
    rawMarkdown,
    publicationUri: PUBLICATION_URI,
    publicUrl: PUBLIC_URL,
  });

  assertEquals(doc.textContent?.length, 10000);
});

Deno.test("documentToMarkdown - produces valid markdown file", () => {
  const doc: StandardDocument = {
    $type: "site.standard.document",
    site: PUBLICATION_URI,
    title: "Test Post",
    publishedAt: "2025-01-15T00:00:00.000Z",
    path: "/posts/test-post",
    description: "A test post",
    content: {
      $type: "site.standard.content.markdown",
      value: "\n# Test\n\nSome content here.",
    },
    tags: ["TypeScript", "Deno"],
  };

  const result = documentToMarkdown(doc);

  assertEquals(result.filename, "test-post.md");
  assertEquals(
    result.content.includes('title: "Test Post"'),
    true,
  );
  assertEquals(result.content.includes("date: 2025-01-15"), true);
  assertEquals(result.content.includes("  - TypeScript"), true);
  assertEquals(result.content.includes("  - Deno"), true);
  assertEquals(
    result.content.includes('excerpt: "A test post"'),
    true,
  );
  assertEquals(result.content.includes("# Test"), true);
});

Deno.test("documentToMarkdown - handles missing optional fields", () => {
  const doc: StandardDocument = {
    $type: "site.standard.document",
    site: PUBLICATION_URI,
    title: "Minimal Post",
    publishedAt: "2025-01-15T00:00:00.000Z",
    path: "/posts/minimal",
  };

  const result = documentToMarkdown(doc);

  assertEquals(result.filename, "minimal.md");
  assertEquals(result.content.includes("tags:"), false);
  assertEquals(result.content.includes("excerpt:"), false);
  assertEquals(result.content.includes("modified:"), false);
});

Deno.test("documentToMarkdown - includes modified date from updatedAt", () => {
  const doc: StandardDocument = {
    $type: "site.standard.document",
    site: PUBLICATION_URI,
    title: "Updated Post",
    publishedAt: "2025-01-15T00:00:00.000Z",
    path: "/posts/updated",
    updatedAt: "2025-02-01T00:00:00.000Z",
  };

  const result = documentToMarkdown(doc);

  assertEquals(result.content.includes("modified: 2025-02-01"), true);
});

Deno.test("round trip - post -> document -> markdown preserves key fields", () => {
  const post = makePost();
  const rawMarkdown = "\n# Test Content\n\nParagraph here.";

  const doc = postToDocument({
    post,
    rawMarkdown,
    publicationUri: PUBLICATION_URI,
    publicUrl: PUBLIC_URL,
  });

  const result = documentToMarkdown(doc);

  // Verify frontmatter fields survive round-trip
  assertEquals(result.content.includes('title: "Test Post"'), true);
  assertEquals(result.content.includes("date: 2025-01-15"), true);
  assertEquals(result.content.includes("  - TypeScript"), true);
  assertEquals(result.content.includes("  - Deno"), true);
  assertEquals(result.content.includes('excerpt: "A test post"'), true);
  // Verify body survives round-trip
  assertEquals(result.content.includes("# Test Content"), true);
  assertEquals(result.content.includes("Paragraph here."), true);
});

Deno.test("documentToMarkdown - handles HTML content type", () => {
  const doc: StandardDocument = {
    $type: "site.standard.document",
    site: PUBLICATION_URI,
    title: "HTML Post",
    publishedAt: "2025-01-15T00:00:00.000Z",
    path: "/posts/html-post",
    content: {
      $type: "site.standard.content.html",
      value: "<h1>Hello</h1><p>World</p>",
    },
  };

  const result = documentToMarkdown(doc);

  assertEquals(
    result.content.includes("<h1>Hello</h1><p>World</p>"),
    true,
  );
});

Deno.test("documentToMarkdown - escapes quotes in title", () => {
  const doc: StandardDocument = {
    $type: "site.standard.document",
    site: PUBLICATION_URI,
    title: 'Post with "quotes"',
    publishedAt: "2025-01-15T00:00:00.000Z",
    path: "/posts/quoted",
  };

  const result = documentToMarkdown(doc);

  assertEquals(
    result.content.includes('title: "Post with \\"quotes\\""'),
    true,
  );
});
