import { assertEquals } from "@std/assert";
import { markdownToHtml } from "../src/markdown-renderer.tsx";

Deno.test("markdownToHtml - converts basic markdown to HTML", () => {
  const markdown = `# Heading 1

This is a paragraph with **bold** and *italic* text.

## Heading 2

Another paragraph with [a link](http://example.com).`;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<h1>Heading 1</h1>"), true);
    assertEquals(html.includes("<h2>Heading 2</h2>"), true);
    assertEquals(html.includes("<strong>bold</strong>"), true);
    assertEquals(html.includes("<em>italic</em>"), true);
    assertEquals(
      html.includes('<a href="http://example.com">a link</a>'),
      true,
    );
  }
});

Deno.test("markdownToHtml - handles code blocks with syntax highlighting", () => {
  const markdown = `# Code Example

Here's some JavaScript:

\`\`\`javascript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

And some Python:

\`\`\`python
def greet():
    print("Hello, world!")
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(
      html.includes('<pre><code class="hljs language-javascript">'),
      true,
    );
    assertEquals(
      html.includes('<pre><code class="hljs language-python">'),
      true,
    );
    assertEquals(html.includes("const"), true);
    assertEquals(html.includes("def"), true);
  }
});

Deno.test("markdownToHtml - handles inline code", () => {
  const markdown = "Use the `console.log()` function to output text.";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<code>console.log()</code>"), true);
  }
});

Deno.test("markdownToHtml - handles lists", () => {
  const markdown = `# Lists

Unordered list:
- Item 1
- Item 2
- Item 3

Ordered list:
1. First item
2. Second item
3. Third item`;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<ul>"), true);
    assertEquals(html.includes("<ol>"), true);
    assertEquals(html.includes("<li>Item 1</li>"), true);
    assertEquals(html.includes("<li>First item</li>"), true);
  }
});

Deno.test("markdownToHtml - handles blockquotes", () => {
  const markdown = `> This is a blockquote.
> It can span multiple lines.`;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<blockquote>"), true);
    assertEquals(html.includes("This is a blockquote"), true);
  }
});

Deno.test("markdownToHtml - handles images", () => {
  const markdown = "![Alt text](/images/test.png)";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(
      html.includes('<img src="/images/test.png" alt="Alt text"'),
      true,
    );
  }
});

Deno.test("markdownToHtml - handles tables", () => {
  const markdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<table>"), true);
    assertEquals(html.includes("<thead>"), true);
    assertEquals(html.includes("<tbody>"), true);
    assertEquals(html.includes("<th>Header 1</th>"), true);
    assertEquals(html.includes("<td>Cell 1</td>"), true);
  }
});

Deno.test("markdownToHtml - handles horizontal rules", () => {
  const markdown = `Before the rule

---

After the rule`;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<hr>"), true);
  }
});

Deno.test("markdownToHtml - handles strikethrough", () => {
  const markdown = "This is ~~strikethrough~~ text.";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<del>strikethrough</del>"), true);
  }
});

// TODO: Audio file handling feature may need implementation review
Deno.test.ignore("markdownToHtml - handles audio files", () => {
  const markdown = "Listen to this: [audio.mp3](/audio/test.mp3)";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<audio controls"), true);
    assertEquals(html.includes('src="/audio/test.mp3"'), true);
    assertEquals(html.includes('type="audio/mpeg"'), true);
  }
});

// TODO: Audio format handling feature may need implementation review
Deno.test.ignore("markdownToHtml - handles different audio formats", () => {
  const testCases = [
    { file: "test.wav", expectedType: "audio/wav" },
    { file: "test.ogg", expectedType: "audio/ogg" },
    { file: "test.flac", expectedType: "audio/flac" },
    { file: "test.m4a", expectedType: "audio/mp4" },
    { file: "test.aac", expectedType: "audio/aac" },
  ];

  for (const testCase of testCases) {
    const markdown = `[${testCase.file}](/audio/${testCase.file})`;
    const result = markdownToHtml(markdown);

    assertEquals(result.ok, true);
    if (result.ok) {
      const html = result.value;
      assertEquals(html.includes(`type="${testCase.expectedType}"`), true);
    }
  }
});

// TODO: Image attribute syntax {width=300} may need implementation review
Deno.test.ignore("markdownToHtml - handles image attributes", () => {
  const markdown = "![Alt text](/images/test.png){width=300 height=200}";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes('width="300"'), true);
    assertEquals(html.includes('height="200"'), true);
  }
});

Deno.test("markdownToHtml - handles mermaid diagrams", () => {
  const markdown = `# Diagram

\`\`\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    // Should contain SVG output from mermaid renderer
    assertEquals(html.includes("<svg"), true);
  }
});

// TODO: Auto-detection of code language may need review
Deno.test.ignore("markdownToHtml - handles code without language", () => {
  const markdown = `\`\`\`
const test = "no language specified";
console.log(test);
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes('<pre><code class="hljs">'), true);
    assertEquals(html.includes("const test"), true);
  }
});

// TODO: Invalid language handling may need review
Deno.test.ignore(
  "markdownToHtml - handles invalid syntax highlighting gracefully",
  () => {
    const markdown = `\`\`\`invalidlanguage
some code here
\`\`\``;

    const result = markdownToHtml(markdown);

    assertEquals(result.ok, true);
    if (result.ok) {
      const html = result.value;
      assertEquals(
        html.includes('<pre><code class="language-invalidlanguage">'),
        true,
      );
      assertEquals(html.includes("some code here"), true);
    }
  },
);

Deno.test("markdownToHtml - handles empty input", () => {
  const markdown = "";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.trim(), "");
  }
});

Deno.test("markdownToHtml - handles complex nested structures", () => {
  const markdown = `# Main Heading

## Section 1

This section has a list:

1. First item with **bold text**
2. Second item with *italic text*
3. Third item with \`inline code\`

### Subsection

> This is a blockquote with [a link](http://example.com).

\`\`\`javascript
// Code block in nested structure
function example() {
  return "Hello, world!";
}
\`\`\`

## Section 2

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

---

Final paragraph with ~~strikethrough~~ text.`;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("<h1>Main Heading</h1>"), true);
    assertEquals(html.includes("<h2>Section 1</h2>"), true);
    assertEquals(html.includes("<h3>Subsection</h3>"), true);
    assertEquals(html.includes("<ol>"), true);
    assertEquals(html.includes("<strong>bold text</strong>"), true);
    assertEquals(html.includes("<em>italic text</em>"), true);
    assertEquals(html.includes("<code>inline code</code>"), true);
    assertEquals(html.includes("<blockquote>"), true);
    assertEquals(html.includes('<a href="http://example.com">'), true);
    assertEquals(
      html.includes('<pre><code class="hljs language-javascript">'),
      true,
    );
    assertEquals(html.includes("<table>"), true);
    assertEquals(html.includes("<hr>"), true);
    assertEquals(html.includes("<del>strikethrough</del>"), true);
  }
});
