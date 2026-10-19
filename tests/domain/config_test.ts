import { assertEquals } from "@std/assert";
import { parseConfig } from "../../src/domain/config.ts";

Deno.test("parseConfig applies defaults for an empty env", () => {
  const { config, warnings } = parseConfig({});
  assertEquals(warnings, []);
  assertEquals(config.env, "development");
  assertEquals(config.server.port, 8000);
  assertEquals(config.server.publicUrl, "http://localhost:8000");
  assertEquals(config.blog.title, "Minimal Blog");
  assertEquals(config.blog.postsDir, "content/posts");
  assertEquals(config.blog.postsPerPage, 10);
  assertEquals(config.site, {
    canonicalUrl: "https://blogo.timok.deno.net",
    name: "Blogo - Modern Development Blog",
    twitterHandle: "@blogo_dev",
  });
});

Deno.test("parseConfig reads each variable", () => {
  const { config, warnings } = parseConfig({
    DENO_ENV: "production",
    PORT: "9001",
    BLOG_TITLE: "T",
    BLOG_DESCRIPTION: "D",
    POSTS_DIR: "posts",
    POSTS_PER_PAGE: "5",
    TWITTER_HANDLE: "@me",
  });
  assertEquals(warnings, []);
  assertEquals(config.env, "production");
  assertEquals(config.debug.enableLogs, false);
  assertEquals(config.server.port, 9001);
  assertEquals(config.server.publicUrl, "http://localhost:9001");
  assertEquals(config.blog, {
    title: "T",
    description: "D",
    postsDir: "posts",
    postsPerPage: 5,
  });
  assertEquals(config.site.twitterHandle, "@me");
});

Deno.test("parseConfig falls back to development with one warning", () => {
  const { config, warnings } = parseConfig({ DENO_ENV: "staging" });
  assertEquals(config.env, "development");
  assertEquals(warnings, [
    'Invalid environment "staging", defaulting to "development"',
  ]);
});

Deno.test("parseConfig sets the canonical URL from PUBLIC_URL", () => {
  const { config } = parseConfig({ PUBLIC_URL: "https://example.com" });
  assertEquals(config.site.canonicalUrl, "https://example.com");
  assertEquals(config.server.publicUrl, "https://example.com");
});

Deno.test("parseConfig ignores an invalid port", () => {
  assertEquals(parseConfig({ PORT: "99999" }).config.server.port, 8000);
});
