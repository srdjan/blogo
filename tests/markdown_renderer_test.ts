import { assertEquals, assertStringIncludes } from "@std/assert";
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

Deno.test("markdownToHtml - handles audio files", () => {
  const markdown = "![Song](/audio/test.mp3){media=audio}";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertStringIncludes(html, '<audio controls="">');
    assertStringIncludes(
      html,
      '<source src="/audio/test.mp3" type="audio/mpeg">',
    );
    assertStringIncludes(html, '<p class="audio-caption">Song</p>');
  }
});

Deno.test("markdownToHtml - handles different audio formats", () => {
  const testCases = [
    { file: "test.wav", expectedType: "audio/wav" },
    { file: "test.ogg", expectedType: "audio/ogg" },
    { file: "test.flac", expectedType: "audio/flac" },
    { file: "test.m4a", expectedType: "audio/mp4" },
    { file: "test.aac", expectedType: "audio/aac" },
  ];

  for (const testCase of testCases) {
    const markdown = `![Song](/audio/${testCase.file}){media=audio}`;
    const result = markdownToHtml(markdown);

    assertEquals(result.ok, true, testCase.file);
    if (result.ok) {
      assertStringIncludes(
        result.value,
        `<source src="/audio/${testCase.file}" type="${testCase.expectedType}">`,
      );
    }
  }
});

Deno.test("markdownToHtml - handles image attributes", () => {
  const markdown = "![Alt](/images/t.png){width=300, height=200}";

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertStringIncludes(
      result.value,
      '<img src="/images/t.png" alt="Alt" width="300" height="200" loading="lazy" decoding="async" style="width: 300px; height: 200px">',
    );
  }
});

Deno.test("markdownToHtml - accepts a space-separated attribute list", () => {
  const spaced = markdownToHtml("![Alt](/images/t.png){width=300 height=200}");
  const commas = markdownToHtml("![Alt](/images/t.png){width=300, height=200}");

  assertEquals(spaced.ok, true);
  assertEquals(commas.ok, true);
  if (spaced.ok && commas.ok) {
    // Fixed: plan finding B6
    assertEquals(spaced.value, commas.value);
    assertStringIncludes(spaced.value, 'width="300"');
    assertStringIncludes(spaced.value, 'height="200"');
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

Deno.test("markdownToHtml - detects Mermaid language case-insensitively", () => {
  const markdown = `\`\`\`Mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\``;

  const result = markdownToHtml(markdown);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.includes("<svg"), true);
  }
});

Deno.test("markdownToHtml - detects Mermaid fences with info string", () => {
  const markdown = `\`\`\`mermaid title=\"Example\"
flowchart TD
    A[Start] --> B[End]
\`\`\``;

  const result = markdownToHtml(markdown);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.includes("<svg"), true);
  }
});

Deno.test("markdownToHtml - mermaid SVG survives DOMPurify sanitization", () => {
  const markdown = `\`\`\`mermaid
flowchart TD
    A[Start] --> B[Decision]
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    // SVG structure must survive DOMPurify
    assertEquals(html.includes("<svg"), true);
    // Core SVG elements that rendermaid generates should not be stripped
    const hasStructuralElements = html.includes("<rect") ||
      html.includes("<path") || html.includes("<text") ||
      html.includes("<line") || html.includes("<g");
    assertEquals(hasStructuralElements, true);
    // The diagram class must survive sanitization
    assertEquals(html.includes("mermaid-diagram"), true);
  }
});

Deno.test("markdownToHtml - mermaid handles angle brackets in labels", () => {
  // marked encodes < as &lt; in code block content before passing to the renderer.
  // The renderer should handle this gracefully - either by decoding or by not crashing.
  const markdown = `\`\`\`mermaid
flowchart TD
    A[Value < 10] --> B[Done]
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    // The output should be valid HTML - either an SVG or an error div, not a crash
    const isValidOutput = html.includes("<svg") ||
      html.includes("mermaid-error");
    assertEquals(isValidOutput, true);
  }
});

Deno.test("markdownToHtml - mermaid error renders with CSS class", () => {
  const markdown = `\`\`\`mermaid
graph TD
    A --> B
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    const html = result.value;
    assertEquals(html.includes("mermaid-error"), true);
    assertEquals(html.includes("flowchart TD"), true);
  }
});

Deno.test("markdownToHtml - handles code without language", () => {
  const markdown = `\`\`\`
const test = "no language specified";
console.log(test);
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertStringIncludes(result.value, '<pre><code class="hljs">');
    assertStringIncludes(result.value, "no language specified");
  }
});

Deno.test("markdownToHtml - handles invalid syntax highlighting gracefully", () => {
  const markdown = `\`\`\`invalidlanguage
some code here
\`\`\``;

  const result = markdownToHtml(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertStringIncludes(result.value, '<pre><code class="hljs">');
    assertStringIncludes(result.value, "code here");
  }
});

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

// --- sanitization ---

Deno.test("markdownToHtml - removes script tags", () => {
  const result = markdownToHtml("Hello <script>alert(1)</script> world");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.includes("<script"), false);
    assertEquals(result.value.includes("alert(1)"), false);
    assertStringIncludes(result.value, "<p>Hello  world</p>");
  }
});

Deno.test("markdownToHtml - removes onerror attributes", () => {
  const result = markdownToHtml('<img src="x" onerror="alert(1)">');

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.includes("onerror"), false);
    assertStringIncludes(result.value, '<img src="x">');
  }
});

Deno.test("markdownToHtml - removes javascript: link targets", () => {
  const result = markdownToHtml("[x](javascript:alert(1))");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.includes('href="javascript:'), false);
    assertStringIncludes(result.value, "<p><a>x</a></p>");
  }
});
