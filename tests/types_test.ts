import { assertEquals } from "@std/assert";
import { createSlug, createTagName, createUrlPath } from "../src/lib/types.ts";

Deno.test("Types - createSlug normalizes strings", () => {
  const slug = createSlug("Hello World! 123");
  assertEquals(slug, "hello-world-123");
});

Deno.test("Types - createSlug handles special characters", () => {
  const slug = createSlug("Test@#$%^&*()");
  assertEquals(slug, "test-");
});

Deno.test("Types - createSlug removes multiple dashes", () => {
  const slug = createSlug("Multiple   Spaces");
  assertEquals(slug, "multiple-spaces");
});

Deno.test("Types - createTagName preserves input", () => {
  const tag = createTagName("TypeScript");
  assertEquals(tag, "TypeScript");
});

Deno.test("Types - createUrlPath preserves input", () => {
  const path = createUrlPath("/posts/test");
  assertEquals(path, "/posts/test");
});