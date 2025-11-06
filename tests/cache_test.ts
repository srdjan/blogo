import { assertEquals } from "@std/assert";
import { createInMemoryCache } from "../src/ports/cache.ts";

Deno.test("Cache - set and get value", () => {
  const cache = createInMemoryCache<string>();

  const setResult = cache.set("key1", "value1");
  assertEquals(setResult.ok, true);

  const getResult = cache.get("key1");
  assertEquals(getResult.ok, true);
  if (getResult.ok) {
    assertEquals(getResult.value, "value1");
  }
});

Deno.test("Cache - get non-existent key returns null", () => {
  const cache = createInMemoryCache<string>();

  const getResult = cache.get("non-existent");
  assertEquals(getResult.ok, true);
  if (getResult.ok) {
    assertEquals(getResult.value, null);
  }
});

Deno.test("Cache - TTL expiration", async () => {
  const cache = createInMemoryCache<string>();

  cache.set("key1", "value1", 10); // 10ms TTL

  const immediate = cache.get("key1");
  assertEquals(immediate.ok, true);
  if (immediate.ok) {
    assertEquals(immediate.value, "value1");
  }

  // Wait for expiration
  await new Promise((resolve) => setTimeout(resolve, 20));

  const expired = cache.get("key1");
  assertEquals(expired.ok, true);
  if (expired.ok) {
    assertEquals(expired.value, null);
  }
});

Deno.test("Cache - delete removes key", () => {
  const cache = createInMemoryCache<string>();

  cache.set("key1", "value1");

  const beforeDelete = cache.get("key1");
  if (beforeDelete.ok) {
    assertEquals(beforeDelete.value, "value1");
  }

  const deleteResult = cache.delete("key1");
  assertEquals(deleteResult.ok, true);

  const afterDelete = cache.get("key1");
  if (afterDelete.ok) {
    assertEquals(afterDelete.value, null);
  }
});

Deno.test("Cache - clear removes all keys", () => {
  const cache = createInMemoryCache<string>();

  cache.set("key1", "value1");
  cache.set("key2", "value2");

  const clearResult = cache.clear();
  assertEquals(clearResult.ok, true);

  const get1 = cache.get("key1");
  const get2 = cache.get("key2");
  if (get1.ok) {
    assertEquals(get1.value, null);
  }
  if (get2.ok) {
    assertEquals(get2.value, null);
  }
});
