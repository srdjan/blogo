import { assertEquals } from "@std/assert";
import {
  validateFrontmatter,
  validateImageReferences,
  validateMarkdownContent,
} from "../../src/domain/validation.ts";

Deno.test("validateFrontmatter - accepts valid frontmatter", () => {
  const validFrontmatter = {
    title: "Test Post",
    date: "2025-01-15",
    excerpt: "A test post",
    tags: ["JavaScript", "Testing"],
    slug: "test-post",
    modified: "2025-01-16",
    draft: false,
    author: "Test Author",
    category: "Tutorial",
  };

  const result = validateFrontmatter(validFrontmatter);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.title, "Test Post");
    assertEquals(result.value.date, "2025-01-15");
  }
});

Deno.test("validateFrontmatter - rejects missing title", () => {
  const invalidFrontmatter = {
    date: "2025-01-15",
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateFrontmatter - rejects missing date", () => {
  const invalidFrontmatter = {
    title: "Test Post",
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateFrontmatter - rejects invalid date format", () => {
  const invalidFrontmatter = {
    title: "Test Post",
    date: "January 15, 2025",
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateFrontmatter - rejects future dates for published posts", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  const futureDateString = futureDate.toISOString().split("T")[0];

  const invalidFrontmatter = {
    title: "Future Post",
    date: futureDateString,
    draft: false,
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateFrontmatter - allows future dates for draft posts", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  const futureDateString = futureDate.toISOString().split("T")[0];

  const validFrontmatter = {
    title: "Future Draft",
    date: futureDateString,
    draft: true,
  };

  const result = validateFrontmatter(validFrontmatter);

  assertEquals(result.ok, true);
});

Deno.test("validateFrontmatter - rejects invalid slug format", () => {
  const invalidFrontmatter = {
    title: "Test Post",
    date: "2025-01-15",
    slug: "Invalid Slug With Spaces",
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateFrontmatter - rejects too many tags", () => {
  const invalidFrontmatter = {
    title: "Test Post",
    date: "2025-01-15",
    tags: Array.from({ length: 15 }, (_, i) => `tag${i}`),
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateFrontmatter - rejects duplicate tags", () => {
  const invalidFrontmatter = {
    title: "Test Post",
    date: "2025-01-15",
    tags: ["JavaScript", "Testing", "JavaScript"],
  };

  const result = validateFrontmatter(invalidFrontmatter);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateMarkdownContent - accepts valid content", () => {
  const validContent = `# Test Post

This is a valid markdown post with enough content to pass validation.

## Section

More content here with \`inline code\` and:

\`\`\`javascript
const test = "code block";
\`\`\`

And some more text.`;

  const result = validateMarkdownContent(validContent);

  assertEquals(result.ok, true);
});

Deno.test("validateMarkdownContent - rejects too short content", () => {
  const shortContent = "Short";

  const result = validateMarkdownContent(shortContent);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateMarkdownContent - detects unclosed code blocks", () => {
  const invalidContent = `# Test Post

This has an unclosed code block:

\`\`\`javascript
const test = "unclosed";

More content after.`;

  const result = validateMarkdownContent(invalidContent);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateMarkdownContent - detects unclosed inline code", () => {
  const invalidContent = `# Test Post

This has unclosed \`inline code.

More content after.`;

  const result = validateMarkdownContent(invalidContent);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateImageReferences - accepts valid image paths", () => {
  const contentWithImages = `# Test Post

Here's an image:

![Alt text](/images/test.png)

And another:

![Another image](https://example.com/image.jpg)`;

  const result = validateImageReferences(contentWithImages);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 2);
    assertEquals(result.value[0], "/images/test.png");
    assertEquals(result.value[1], "https://example.com/image.jpg");
  }
});

Deno.test("validateImageReferences - warns about relative paths", () => {
  const contentWithRelativeImage = `# Test Post

![Relative image](images/test.png)`;

  const result = validateImageReferences(contentWithRelativeImage);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateImageReferences - warns about invalid extensions", () => {
  const contentWithInvalidImage = `# Test Post

![Invalid image](/images/test.txt)`;

  const result = validateImageReferences(contentWithInvalidImage);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("validateImageReferences - handles content with no images", () => {
  const contentWithoutImages = `# Test Post

This post has no images, just text content.`;

  const result = validateImageReferences(contentWithoutImages);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.length, 0);
  }
});
