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

// --- boundaries with exact messages ---

const PREFIX = "Frontmatter validation failed: ";
const BASE = { title: "Test Post", date: "2025-01-15" };

const repeat = (char: string, count: number): string => char.repeat(count);
const unique = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`);

type BoundaryCase = {
  readonly name: string;
  readonly input: Record<string, unknown>;
  readonly message?: string;
};

const boundaryCases: readonly BoundaryCase[] = [
  { name: "title of 200 characters", input: { title: repeat("t", 200) } },
  {
    name: "title of 201 characters",
    input: { title: repeat("t", 201) },
    message: "Title must be between 1 and 200 characters",
  },
  {
    name: "empty title",
    input: { title: "" },
    message: "Title is required and must be a string",
  },
  {
    name: "non-string title",
    input: { title: 42 },
    message: "Title is required and must be a string",
  },
  { name: "10 tags", input: { tags: unique("tag", 10) } },
  {
    name: "11 tags",
    input: { tags: unique("tag", 11) },
    message: "Cannot have more than 10 tags",
  },
  { name: "tag of 50 characters", input: { tags: [repeat("g", 50)] } },
  {
    name: "tag of 51 characters",
    input: { tags: [repeat("g", 51)] },
    message: `Tag "${repeat("g", 51)}" is too long (max 50 characters)`,
  },
  {
    name: "non-array tags",
    input: { tags: "typescript" },
    message: "Tags must be an array",
  },
  { name: "excerpt of 500 characters", input: { excerpt: repeat("e", 500) } },
  {
    name: "excerpt of 501 characters",
    input: { excerpt: repeat("e", 501) },
    message: "Excerpt must be no more than 500 characters",
  },
  { name: "author of 100 characters", input: { author: repeat("a", 100) } },
  {
    name: "author of 101 characters",
    input: { author: repeat("a", 101) },
    message: "Author name must be no more than 100 characters",
  },
  { name: "category of 50 characters", input: { category: repeat("c", 50) } },
  {
    name: "category of 51 characters",
    input: { category: repeat("c", 51) },
    message: "Category must be no more than 50 characters",
  },
  { name: "10 topics", input: { topics: unique("topic", 10) } },
  {
    name: "11 topics",
    input: { topics: unique("topic", 11) },
    message: "Cannot have more than 10 topics",
  },
  { name: "topic of 50 characters", input: { topics: [repeat("p", 50)] } },
  {
    name: "topic of 51 characters",
    input: { topics: [repeat("p", 51)] },
    message: `Topic "${repeat("p", 51)}" is too long (max 50 characters)`,
  },
];

for (const { name, input, message } of boundaryCases) {
  Deno.test(`validateFrontmatter - ${name} ${message ? "fails" : "passes"}`, () => {
    const result = validateFrontmatter({ ...BASE, ...input });

    if (message === undefined) {
      assertEquals(result.ok, true);
      return;
    }
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(result.error.message, `${PREFIX}${message}`);
    }
  });
}

Deno.test("validateFrontmatter - accepts the impossible date 2025-02-30", () => {
  const result = validateFrontmatter({
    title: "Test Post",
    date: "2025-02-30",
  });

  // Current behavior; see plan finding B11
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.value.date, "2025-02-30");
});
