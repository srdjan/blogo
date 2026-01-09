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

Deno.test("Types - createTagName returns ok for valid input", () => {
  const result = createTagName("TypeScript");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value, "TypeScript");
  }
});

Deno.test("Types - createTagName trims whitespace", () => {
  const result = createTagName("  TypeScript  ");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value, "TypeScript");
  }
});

Deno.test("Types - createTagName returns error for empty string", () => {
  const result = createTagName("");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("Types - createTagName returns error for whitespace only", () => {
  const result = createTagName("   ");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("Types - createTagName returns error for too long input", () => {
  const longTag = "a".repeat(51);
  const result = createTagName(longTag);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ValidationError");
  }
});

Deno.test("Types - createUrlPath preserves input", () => {
  const path = createUrlPath("/posts/test");
  assertEquals(path, "/posts/test");
});
