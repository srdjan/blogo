import { assertEquals } from "@std/assert";
import { createAnalyticsService } from "../../src/domain/analytics.ts";
import type { ViewCountStore } from "../../src/ports/kv.ts";
import type { Slug } from "../../src/lib/types.ts";

const slug = (s: string): Slug => s as Slug;

// Local: in-memory store with a version counter per key and a hook that
// can force compareAndSet to fail.
function createMemoryViewStore(
  failCommits: (call: number) => boolean = () => false,
): ViewCountStore & { readonly commitCalls: () => number } {
  const data = new Map<string, { value: number; version: number }>();
  let calls = 0;
  return {
    commitCalls: () => calls,
    get: (key) => {
      const entry = data.get(key);
      return Promise.resolve({
        value: entry?.value ?? null,
        versionstamp: entry ? String(entry.version) : null,
      });
    },
    compareAndSet: (key, expected, value) => {
      calls++;
      if (failCommits(calls)) return Promise.resolve(false);
      const entry = data.get(key);
      const actual = entry ? String(entry.version) : null;
      if (actual !== expected) return Promise.resolve(false);
      data.set(key, { value, version: (entry?.version ?? 0) + 1 });
      return Promise.resolve(true);
    },
    list: () =>
      Promise.resolve(
        [...data.entries()].map(([k, v]) => ({ slug: k, value: v.value })),
      ),
    close: () => {},
  };
}

Deno.test("analytics - view count of an unknown slug is 0", async () => {
  const service = createAnalyticsService(createMemoryViewStore());
  const result = await service.getViewCount(slug("missing"));
  assertEquals(result.ok && result.value, 0);
});

Deno.test("analytics - two increments give 2", async () => {
  const service = createAnalyticsService(createMemoryViewStore());
  await service.incrementViewCount(slug("a"));
  const second = await service.incrementViewCount(slug("a"));
  assertEquals(second.ok && second.value, 2);
  const read = await service.getViewCount(slug("a"));
  assertEquals(read.ok && read.value, 2);
});

Deno.test("analytics - getAllViewCounts lists every slug", async () => {
  const service = createAnalyticsService(createMemoryViewStore());
  await service.incrementViewCount(slug("a"));
  await service.incrementViewCount(slug("b"));
  await service.incrementViewCount(slug("b"));
  const all = await service.getAllViewCounts();
  assertEquals(all.ok && all.value, { a: 1, b: 2 });
});

Deno.test("analytics - increment fails after 10 conflicting attempts", async () => {
  const store = createMemoryViewStore(() => true);
  const service = createAnalyticsService(store);
  const result = await service.incrementViewCount(slug("a"));
  assertEquals(store.commitCalls(), 10);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "IOError");
    assertEquals(
      result.error.message,
      "Failed to increment view count for a: too many conflicts",
    );
  }
});

Deno.test("analytics - increment succeeds after one conflict", async () => {
  const store = createMemoryViewStore((call) => call === 1);
  const service = createAnalyticsService(store);
  const result = await service.incrementViewCount(slug("a"));
  assertEquals(result.ok && result.value, 1);
  assertEquals(store.commitCalls(), 2);
});
