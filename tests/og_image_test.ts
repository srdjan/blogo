import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { generateDefaultOGImage, generateOGImage } from "../src/og-image.ts";

Deno.test("generateOGImage - generates valid SVG with basic inputs", () => {
  const svg = generateOGImage("Test Title");

  // Should be valid SVG
  assertStringIncludes(svg, '<svg width="1200" height="630"');
  assertStringIncludes(svg, "</svg>");

  // Should include the title
  assertStringIncludes(svg, "Test Title");

  // Should include header elements
  assertStringIncludes(svg, "BLOG");
  assertStringIncludes(svg, "timok.deno.net");
});

Deno.test("generateOGImage - truncates long title", () => {
  const longTitle =
    "This is a very long title that should be truncated because it exceeds fifty characters";
  const svg = generateOGImage(longTitle);

  // Should be truncated at 47 characters with ellipsis
  assertStringIncludes(
    svg,
    "This is a very long title that should be trunca...",
  );
});

Deno.test("generateOGImage - removes '- Blog' suffix from title", () => {
  const svg = generateOGImage("My Post - Blog");

  // Should not include " - Blog" in the output
  assertStringIncludes(svg, "My Post");
  assertEquals(svg.includes("My Post - Blog"), false);
});

Deno.test("generateOGImage - includes subtitle when provided", () => {
  const svg = generateOGImage("Test Title", "This is a subtitle");

  assertStringIncludes(svg, "Test Title");
  assertStringIncludes(svg, "This is a subtitle");
});

Deno.test("generateOGImage - truncates long subtitle", () => {
  const longSubtitle =
    "This is a very long subtitle that exceeds the eighty character limit and should be truncated with ellipsis";
  const svg = generateOGImage("Title", longSubtitle);

  // Should be truncated at 77 characters + "..."
  assertStringIncludes(
    svg,
    "This is a very long subtitle that exceeds the eighty character limit and shou...",
  );
});

Deno.test("generateOGImage - includes tags when provided", () => {
  const svg = generateOGImage("Title", undefined, ["TypeScript", "Deno"]);

  assertStringIncludes(svg, "#TypeScript");
  assertStringIncludes(svg, "#Deno");
});

Deno.test("generateOGImage - limits tags to 3", () => {
  const svg = generateOGImage("Title", undefined, [
    "Tag1",
    "Tag2",
    "Tag3",
    "Tag4",
    "Tag5",
  ]);

  // Should include first 3 tags
  assertStringIncludes(svg, "#Tag1");
  assertStringIncludes(svg, "#Tag2");
  assertStringIncludes(svg, "#Tag3");

  // Should not include tags 4 and 5
  assertEquals(svg.includes("#Tag4"), false);
  assertEquals(svg.includes("#Tag5"), false);
});

Deno.test("generateOGImage - escapes special XML characters in title", () => {
  const svg = generateOGImage('Title with <special> & "characters"');

  // Should escape XML entities
  assertStringIncludes(svg, "&lt;special&gt;");
  assertStringIncludes(svg, "&amp;");
  assertStringIncludes(svg, "&quot;");

  // Should not include unescaped characters
  assertEquals(svg.includes('Title with <special> & "characters"'), false);
});

Deno.test("generateOGImage - escapes special XML characters in subtitle", () => {
  const svg = generateOGImage("Title", "Subtitle with <tags> & more");

  assertStringIncludes(svg, "&lt;tags&gt;");
  assertStringIncludes(svg, "&amp;");
});

Deno.test("generateOGImage - escapes special XML characters in tags", () => {
  const svg = generateOGImage("Title", undefined, [
    "React&Redux",
    "C++",
    "<Script>",
  ]);

  assertStringIncludes(svg, "#React&amp;Redux");
  assertStringIncludes(svg, "#C++");
  assertStringIncludes(svg, "#&lt;Script&gt;");
});

Deno.test("generateOGImage - positions tags differently based on subtitle presence", () => {
  const withSubtitle = generateOGImage("Title", "Subtitle", ["Tag1"]);
  const withoutSubtitle = generateOGImage("Title", undefined, ["Tag1"]);

  // With subtitle, tags should be at y=340
  assertStringIncludes(withSubtitle, "translate(100, 340)");

  // Without subtitle, tags should be at y=300
  assertStringIncludes(withoutSubtitle, "translate(100, 300)");
});

Deno.test("generateOGImage - includes footer elements", () => {
  const svg = generateOGImage("Title");

  assertStringIncludes(svg, "Claude &amp; Srdjan vibe coded together...");
  assertStringIncludes(svg, "⊣˚∆˚⊢");
});

Deno.test("generateOGImage - generates valid SVG structure", () => {
  const svg = generateOGImage("Title", "Subtitle", ["Tag1", "Tag2"]);

  // Should have proper SVG structure
  assertStringIncludes(svg, '<svg width="1200" height="630"');
  assertStringIncludes(svg, 'xmlns="http://www.w3.org/2000/svg"');
  assertStringIncludes(svg, "</svg>");

  // Should include defs for grid pattern
  assertStringIncludes(svg, "<defs>");
  assertStringIncludes(svg, '<pattern id="grid"');

  // Should include background
  assertStringIncludes(svg, 'fill="#ffffff"');

  // Should include border
  assertStringIncludes(svg, 'stroke="#000000"');
});

Deno.test("generateDefaultOGImage - generates valid default image", () => {
  const svg = generateDefaultOGImage();

  // Should include default title
  assertStringIncludes(svg, "Blog");

  // Should include default subtitle
  assertStringIncludes(
    svg,
    "A minimal blog built with mono-jsx, Deno &amp; TypeScript",
  );

  // Should include default tags
  assertStringIncludes(svg, "#WebDev");
  assertStringIncludes(svg, "#TypeScript");
  assertStringIncludes(svg, "#Deno");

  // Should be valid SVG
  assertStringIncludes(svg, '<svg width="1200" height="630"');
  assertStringIncludes(svg, "</svg>");
});

Deno.test("generateOGImage - handles empty string title", () => {
  const svg = generateOGImage("");

  // Should still generate valid SVG structure
  assertStringIncludes(svg, '<svg width="1200" height="630"');
  assertStringIncludes(svg, "</svg>");
});

Deno.test("generateOGImage - handles empty tags array", () => {
  const svg = generateOGImage("Title", "Subtitle", []);

  // Should not include tag badges (checking for #tag pattern in text elements)
  assertEquals(svg.includes("#Tag"), false);
  assertEquals(svg.includes("#TypeScript"), false);

  // Should still be valid SVG
  assertStringIncludes(svg, '<svg width="1200" height="630"');
});
