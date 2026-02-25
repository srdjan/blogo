import { assertEquals } from "@std/assert";
import {
  getMermaidInfo,
  isValidMermaidSyntax,
  renderMermaidToSVG,
  renderMermaidWithConfig,
} from "../src/mermaid-renderer.ts";

const VALID_FLOWCHART = `flowchart TD
    A[Start] --> B[Process]
    B --> C[End]`;

Deno.test("renderMermaidToSVG - renders valid flowchart to SVG with diagram class", () => {
  const result = renderMermaidToSVG(VALID_FLOWCHART);
  assertEquals(result.includes("<svg"), true);
  assertEquals(result.includes('class="mermaid-diagram"'), true);
});

Deno.test("renderMermaidToSVG - returns error HTML for graph TD syntax", () => {
  const result = renderMermaidToSVG("graph TD\n    A --> B");
  assertEquals(result.includes('class="mermaid-error"'), true);
  assertEquals(result.includes("flowchart TD"), true);
});

Deno.test("renderMermaidToSVG - returns error HTML for sequenceDiagram", () => {
  const result = renderMermaidToSVG("sequenceDiagram\n    A->>B: Hello");
  assertEquals(result.includes('class="mermaid-error"'), true);
  assertEquals(result.includes("not yet supported"), true);
});

Deno.test("renderMermaidToSVG - returns error HTML for invalid syntax without throwing", () => {
  const result = renderMermaidToSVG("this is not valid mermaid at all %%%");
  assertEquals(result.includes('class="mermaid-error"'), true);
  assertEquals(typeof result, "string");
});

Deno.test("renderMermaidToSVG - cache returns identical output on second call", () => {
  const first = renderMermaidToSVG(VALID_FLOWCHART);
  const second = renderMermaidToSVG(VALID_FLOWCHART);
  assertEquals(first, second);
});

Deno.test("isValidMermaidSyntax - returns true for valid flowchart", () => {
  assertEquals(isValidMermaidSyntax(VALID_FLOWCHART), true);
});

Deno.test("isValidMermaidSyntax - returns false for graph TD", () => {
  assertEquals(isValidMermaidSyntax("graph TD\n    A --> B"), false);
});

Deno.test("isValidMermaidSyntax - returns false for garbage input", () => {
  assertEquals(isValidMermaidSyntax("not mermaid"), false);
});

Deno.test("renderMermaidWithConfig - renders with custom config", () => {
  const result = renderMermaidWithConfig(VALID_FLOWCHART, { width: 1200 });
  assertEquals(result.includes("<svg"), true);
  assertEquals(result.includes('class="mermaid-diagram"'), true);
});

Deno.test("renderMermaidWithConfig - caches with config key", () => {
  const first = renderMermaidWithConfig(VALID_FLOWCHART, { width: 500 });
  const second = renderMermaidWithConfig(VALID_FLOWCHART, { width: 500 });
  assertEquals(first, second);
});

Deno.test("getMermaidInfo - returns info for valid diagram", () => {
  const info = getMermaidInfo(VALID_FLOWCHART);
  assertEquals(info.isValid, true);
  assertEquals(typeof info.nodeCount, "number");
  assertEquals(typeof info.edgeCount, "number");
  assertEquals(typeof info.complexity, "number");
});

Deno.test("getMermaidInfo - returns invalid for bad input", () => {
  const info = getMermaidInfo("not mermaid");
  assertEquals(info.isValid, false);
});
