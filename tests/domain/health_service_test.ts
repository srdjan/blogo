import { assertEquals } from "@std/assert";
import { createHealthService } from "../../src/domain/health.ts";
import type { FileSystem } from "../../src/ports/file-system.ts";
import type { Cache } from "../../src/ports/cache.ts";
import { createInMemoryCache } from "../../src/ports/cache.ts";

// Mock FileSystem implementation for testing
function createMockFileSystem(shouldFail = false): FileSystem {
  return {
    readFile: async (path: string): Promise<string> => {
      if (shouldFail) throw new Error("File system error");
      return "mock content";
    },

    readDir: async (path: string): Promise<readonly string[]> => {
      if (shouldFail) throw new Error("Directory read error");
      return ["file1.md", "file2.md"];
    },

    exists: async (path: string): Promise<boolean> => {
      if (shouldFail) return false;
      return true;
    },

    stat: async (path: string) => {
      if (shouldFail) return null;
      return {
        name: "test.md",
        isFile: true,
        isDirectory: false,
        size: 100,
        mtime: new Date(),
      };
    },
  };
}

Deno.test("HealthService - reports healthy status when all checks pass", async () => {
  const fileSystem = createMockFileSystem(false);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime: Date.now() - 10000, // 10 seconds ago
  });

  const result = await healthService.checkHealth();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.status, "healthy");
    assertEquals(result.value.checks.length, 2);
    assertEquals(result.value.checks[0]?.name, "filesystem");
    assertEquals(result.value.checks[0]?.status, "healthy");
    assertEquals(result.value.checks[1]?.name, "cache");
    assertEquals(result.value.checks[1]?.status, "healthy");
  }
});

Deno.test("HealthService - reports unhealthy status when filesystem fails", async () => {
  const fileSystem = createMockFileSystem(true);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime: Date.now(),
  });

  const result = await healthService.checkHealth();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.status, "unhealthy");

    const filesystemCheck = result.value.checks.find((check) =>
      check.name === "filesystem"
    );
    assertEquals(filesystemCheck?.status, "unhealthy");
  }
});

Deno.test("HealthService - filesystem check detects missing directory", async () => {
  const fileSystem = createMockFileSystem(true);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "nonexistent",
    startTime: Date.now(),
  });

  const filesystemCheck = await healthService.checkFileSystem();

  assertEquals(filesystemCheck.name, "filesystem");
  assertEquals(filesystemCheck.status, "unhealthy");
  assertEquals(filesystemCheck.message?.includes("not found"), true);
});

Deno.test("HealthService - cache check validates operations", async () => {
  const fileSystem = createMockFileSystem(false);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime: Date.now(),
  });

  const cacheCheck = await healthService.checkCache();

  assertEquals(cacheCheck.name, "cache");
  assertEquals(cacheCheck.status, "healthy");
  assertEquals(cacheCheck.message, "Cache operations working");
});

Deno.test("HealthService - provides system metrics", () => {
  const fileSystem = createMockFileSystem(false);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime: Date.now() - 5000, // 5 seconds ago
  });

  const metrics = healthService.getMetrics();

  assertEquals(typeof metrics.memory.used, "number");
  assertEquals(typeof metrics.memory.total, "number");
  assertEquals(typeof metrics.memory.percentage, "number");
  assertEquals(typeof metrics.requests.total, "number");
  assertEquals(typeof metrics.requests.errors, "number");
  assertEquals(typeof metrics.requests.averageResponseTime, "number");
});

Deno.test("HealthService - includes uptime in health report", async () => {
  const startTime = Date.now() - 30000; // 30 seconds ago
  const fileSystem = createMockFileSystem(false);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime,
  });

  const result = await healthService.checkHealth();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.uptime >= 30000, true);
    assertEquals(result.value.version, "1.0.0");
    assertEquals(typeof result.value.timestamp, "string");
  }
});

Deno.test("HealthService - handles cache operation failures", async () => {
  const fileSystem = createMockFileSystem(false);

  // Create a mock cache that fails operations
  const failingCache: Cache<unknown> = {
    get: () => ({ ok: false, error: "CACHE_ERROR" }),
    set: () => ({ ok: false, error: "CACHE_ERROR" }),
    delete: () => ({ ok: false, error: "CACHE_ERROR" }),
    clear: () => ({ ok: false, error: "CACHE_ERROR" }),
  };

  const healthService = createHealthService({
    fileSystem,
    cache: failingCache,
    postsDir: "content/posts",
    startTime: Date.now(),
  });

  const cacheCheck = await healthService.checkCache();

  assertEquals(cacheCheck.name, "cache");
  assertEquals(cacheCheck.status, "unhealthy");
  assertEquals(cacheCheck.message, "Cache set operation failed");
});

Deno.test("HealthService - measures check duration", async () => {
  const fileSystem = createMockFileSystem(false);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime: Date.now(),
  });

  const filesystemCheck = await healthService.checkFileSystem();
  const cacheCheck = await healthService.checkCache();

  assertEquals(typeof filesystemCheck.duration, "number");
  assertEquals(filesystemCheck.duration! >= 0, true);
  assertEquals(typeof cacheCheck.duration, "number");
  assertEquals(cacheCheck.duration! >= 0, true);
});

Deno.test("HealthService - includes timestamps in checks", async () => {
  const fileSystem = createMockFileSystem(false);
  const cache = createInMemoryCache<unknown>();

  const healthService = createHealthService({
    fileSystem,
    cache,
    postsDir: "content/posts",
    startTime: Date.now(),
  });

  const result = await healthService.checkHealth();

  assertEquals(result.ok, true);
  if (result.ok) {
    for (const check of result.value.checks) {
      assertEquals(typeof check.timestamp, "string");
      // Verify it's a valid ISO timestamp
      assertEquals(isNaN(Date.parse(check.timestamp)), false);
    }
  }
});
