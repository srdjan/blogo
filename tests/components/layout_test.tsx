import { assertEquals, assertStringIncludes } from "@std/assert";
import { renderLayout } from "../../src/components/Layout.tsx";
import type { SiteConfig } from "../../src/domain/config.ts";
import { createUrlPath } from "../../src/lib/types.ts";

const SITE: SiteConfig = {
  canonicalUrl: "https://site.example",
  name: "Example Site",
  twitterHandle: "@example",
};

const baseProps = {
  title: "A Title",
  description: "A description",
  path: createUrlPath("/about"),
  children: <p>Body</p>,
};

Deno.test("renderLayout returns a full HTML string", () => {
  const html = renderLayout(
    { ...baseProps, origin: "https://o.example" },
    SITE,
  );
  assertEquals(html.startsWith("<!DOCTYPE html>"), true);
  assertStringIncludes(html, "<p>Body</p>");
  assertStringIncludes(
    html,
    '<link rel="canonical" href="https://o.example/about">',
  );
  assertStringIncludes(html, 'property="og:title" content="A Title"');
});

Deno.test("renderLayout falls back to the site canonical URL without an origin", () => {
  const html = renderLayout(baseProps, SITE);
  assertStringIncludes(
    html,
    '<link rel="canonical" href="https://site.example/about">',
  );
});

Deno.test("renderLayout uses the Twitter handle and name from site", () => {
  const html = renderLayout(baseProps, SITE);
  assertStringIncludes(html, 'name="twitter:site" content="@example"');
  assertStringIncludes(html, 'name="twitter:creator" content="@example"');
  assertStringIncludes(html, "Example Site");
});

Deno.test("renderLayout emits BlogPosting JSON-LD for an article", () => {
  const html = renderLayout({ ...baseProps, type: "article" }, SITE);
  assertStringIncludes(html, '"@type":"BlogPosting"');
});

Deno.test("renderLayout emits Blog JSON-LD by default", () => {
  const html = renderLayout(baseProps, SITE);
  assertStringIncludes(html, '"@type":"Blog"');
});
