import { assertEquals } from "@std/assert";
import { createAtProtoService } from "../../src/domain/atproto.ts";
import type { AtProtoClient } from "../../src/ports/atproto.ts";
import type { FileSystem } from "../../src/ports/file-system.ts";
import type { FileWriter } from "../../src/ports/writer.ts";
import type { Logger } from "../../src/ports/logger.ts";
import type { AtProtoConfig } from "../../src/config/atproto.ts";
import type { AppResult } from "../../src/lib/types.ts";
import { ok } from "../../src/lib/result.ts";
import type {
  GetRecordResponse,
  ListRecordsResponse,
  PutRecordResponse,
  StandardDocument,
} from "../../src/atproto/types.ts";

// --- Mock helpers ---

type StoredRecord = { readonly record: Record<string, unknown> };

function createMockClient(): AtProtoClient & {
  readonly store: Map<string, StoredRecord>;
} {
  const store = new Map<string, StoredRecord>();

  return {
    store,
    putRecord: async (params): Promise<AppResult<PutRecordResponse>> => {
      const key = `${params.collection}/${params.rkey}`;
      store.set(key, { record: params.record });
      return ok({
        uri: `at://did:plc:test/${params.collection}/${params.rkey}`,
        cid: "bafytest",
      });
    },
    getRecord: async <T>(
      params: { readonly collection: string; readonly rkey: string },
    ): Promise<AppResult<GetRecordResponse<T>>> => {
      const key = `${params.collection}/${params.rkey}`;
      const entry = store.get(key);
      if (!entry) {
        return {
          ok: false,
          error: {
            kind: "NotFound",
            message: `Record not found: ${key}`,
          },
        };
      }
      return ok({
        uri: `at://did:plc:test/${params.collection}/${params.rkey}`,
        cid: "bafytest",
        value: entry.record as unknown as T,
      });
    },
    listRecords: async <T>(
      params: {
        readonly collection: string;
        readonly limit?: number;
        readonly cursor?: string;
      },
    ): Promise<AppResult<ListRecordsResponse<T>>> => {
      const records: {
        uri: string;
        cid: string;
        value: T;
      }[] = [];
      for (const [key, entry] of store.entries()) {
        if (key.startsWith(params.collection + "/")) {
          const rkey = key.substring(params.collection.length + 1);
          records.push({
            uri: `at://did:plc:test/${params.collection}/${rkey}`,
            cid: "bafytest",
            value: entry.record as unknown as T,
          });
        }
      }
      return ok({ records });
    },
    deleteRecord: async (): Promise<AppResult<void>> => {
      return ok(undefined);
    },
    getDid: () => "did:plc:test",
  };
}

function createMockFileSystem(
  files: Record<string, string>,
): FileSystem {
  return {
    readFile: async (path: string): Promise<AppResult<string>> => {
      if (path in files) {
        return ok(files[path] ?? "");
      }
      return {
        ok: false,
        error: { kind: "IOError", message: `Not found: ${path}` },
      };
    },
    readDir: async (path: string): Promise<AppResult<readonly string[]>> => {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const entries = Object.keys(files)
        .filter((f) => f.startsWith(prefix))
        .map((f) => f.substring(prefix.length))
        .filter((n) => !n.includes("/"));
      return ok(entries);
    },
    exists: async (path: string): Promise<boolean> => path in files,
    stat: async () => null,
  };
}

function createMockFileWriter(): FileWriter & {
  readonly written: Map<string, string>;
} {
  const written = new Map<string, string>();
  return {
    written,
    writeFile: async (
      path: string,
      content: string,
    ): Promise<AppResult<void>> => {
      written.set(path, content);
      return ok(undefined);
    },
    ensureDir: async (): Promise<AppResult<void>> => ok(undefined),
    copyDir: async (): Promise<AppResult<void>> => ok(undefined),
    clean: async (): Promise<AppResult<void>> => ok(undefined),
  };
}

function createMockLogger(): Logger {
  return {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  };
}

const TEST_CONFIG: AtProtoConfig = {
  did: "did:plc:test",
  handle: "test.bsky.social",
  service: "https://bsky.social",
  appPassword: "test-password",
};

const POST_CONTENT = `---
title: Test Post
date: 2025-01-15
excerpt: A test post
tags:
  - TypeScript
  - Deno
---

# Test Content

Paragraph here.`;

// --- Tests ---

Deno.test("AtProtoService - ensurePublication creates publication record", async () => {
  const client = createMockClient();
  const service = createAtProtoService({
    client,
    fileSystem: createMockFileSystem({}),
    fileWriter: createMockFileWriter(),
    logger: createMockLogger(),
    config: TEST_CONFIG,
    postsDir: "content/posts",
    publicUrl: "https://blog.example.com",
    blogName: "Test Blog",
    blogDescription: "A test blog",
  });

  const result = await service.ensurePublication();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(
      result.value.uri,
      "at://did:plc:test/site.standard.publication/self",
    );
  }

  // Verify stored record
  const stored = client.store.get("site.standard.publication/self");
  assertEquals(stored !== undefined, true);
  const record = stored!.record as Record<string, unknown>;
  assertEquals(record["$type"], "site.standard.publication");
  assertEquals(record["name"], "Test Blog");
  assertEquals(record["url"], "https://blog.example.com");
});

Deno.test("AtProtoService - publishPost creates correct document record", async () => {
  const client = createMockClient();
  const files: Record<string, string> = {
    "content/posts/test-post.md": POST_CONTENT,
  };

  const service = createAtProtoService({
    client,
    fileSystem: createMockFileSystem(files),
    fileWriter: createMockFileWriter(),
    logger: createMockLogger(),
    config: TEST_CONFIG,
    postsDir: "content/posts",
    publicUrl: "https://blog.example.com",
    blogName: "Test Blog",
    blogDescription: "A test blog",
  });

  const result = await service.publishPost(
    "test-post" as import("../../src/lib/types.ts").Slug,
  );

  assertEquals(result.ok, true);

  // Verify stored document record
  const stored = client.store.get("site.standard.document/test-post");
  assertEquals(stored !== undefined, true);
  const record = stored!.record as Record<string, unknown>;
  assertEquals(record["$type"], "site.standard.document");
  assertEquals(record["title"], "Test Post");
  assertEquals(record["path"], "/posts/test-post");
});

Deno.test("AtProtoService - publishAll publishes all markdown files", async () => {
  const client = createMockClient();
  const files: Record<string, string> = {
    "content/posts/post-one.md": POST_CONTENT,
    "content/posts/post-two.md": POST_CONTENT.replace(
      "Test Post",
      "Second Post",
    ),
  };

  const service = createAtProtoService({
    client,
    fileSystem: createMockFileSystem(files),
    fileWriter: createMockFileWriter(),
    logger: createMockLogger(),
    config: TEST_CONFIG,
    postsDir: "content/posts",
    publicUrl: "https://blog.example.com",
    blogName: "Test Blog",
    blogDescription: "A test blog",
  });

  const result = await service.publishAll();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.published, 2);
    assertEquals(result.value.errors.length, 0);
  }
});

Deno.test("AtProtoService - pullAll writes documents as markdown files", async () => {
  const client = createMockClient();
  const fileWriter = createMockFileWriter();

  // Pre-populate PDS with a document
  client.store.set("site.standard.document/pulled-post", {
    record: {
      $type: "site.standard.document",
      site: "at://did:plc:test/site.standard.publication/self",
      title: "Pulled Post",
      publishedAt: "2025-01-15T00:00:00.000Z",
      path: "/posts/pulled-post",
      description: "A pulled post",
      content: {
        $type: "site.standard.content.markdown",
        value: "\n# Pulled\n\nContent from PDS.",
      },
      tags: ["Testing"],
    },
  });

  const service = createAtProtoService({
    client,
    fileSystem: createMockFileSystem({}), // empty - no existing files
    fileWriter,
    logger: createMockLogger(),
    config: TEST_CONFIG,
    postsDir: "content/posts",
    publicUrl: "https://blog.example.com",
    blogName: "Test Blog",
    blogDescription: "A test blog",
  });

  const result = await service.pullAll();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.pulled, 1);
    assertEquals(result.value.skipped, 0);
  }

  // Verify file was written
  const writtenContent = fileWriter.written.get(
    "content/posts/pulled-post.md",
  );
  assertEquals(writtenContent !== undefined, true);
  assertEquals(writtenContent!.includes('title: "Pulled Post"'), true);
  assertEquals(writtenContent!.includes("# Pulled"), true);
});

Deno.test("AtProtoService - pullAll skips existing files without force", async () => {
  const client = createMockClient();
  const fileWriter = createMockFileWriter();

  client.store.set("site.standard.document/existing-post", {
    record: {
      $type: "site.standard.document",
      site: "at://did:plc:test/site.standard.publication/self",
      title: "Existing Post",
      publishedAt: "2025-01-15T00:00:00.000Z",
      path: "/posts/existing-post",
      content: {
        $type: "site.standard.content.markdown",
        value: "\n# Existing\n\nContent.",
      },
    },
  });

  const existingFiles: Record<string, string> = {
    "content/posts/existing-post.md": "existing content",
  };

  const service = createAtProtoService({
    client,
    fileSystem: createMockFileSystem(existingFiles),
    fileWriter,
    logger: createMockLogger(),
    config: TEST_CONFIG,
    postsDir: "content/posts",
    publicUrl: "https://blog.example.com",
    blogName: "Test Blog",
    blogDescription: "A test blog",
  });

  const result = await service.pullAll({ force: false });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.pulled, 0);
    assertEquals(result.value.skipped, 1);
  }

  // Verify no file was written
  assertEquals(fileWriter.written.size, 0);
});

Deno.test("AtProtoService - pullAll overwrites with force flag", async () => {
  const client = createMockClient();
  const fileWriter = createMockFileWriter();

  client.store.set("site.standard.document/existing-post", {
    record: {
      $type: "site.standard.document",
      site: "at://did:plc:test/site.standard.publication/self",
      title: "Updated Post",
      publishedAt: "2025-01-15T00:00:00.000Z",
      path: "/posts/existing-post",
      content: {
        $type: "site.standard.content.markdown",
        value: "\n# Updated\n\nNew content.",
      },
    },
  });

  const existingFiles: Record<string, string> = {
    "content/posts/existing-post.md": "old content",
  };

  const service = createAtProtoService({
    client,
    fileSystem: createMockFileSystem(existingFiles),
    fileWriter,
    logger: createMockLogger(),
    config: TEST_CONFIG,
    postsDir: "content/posts",
    publicUrl: "https://blog.example.com",
    blogName: "Test Blog",
    blogDescription: "A test blog",
  });

  const result = await service.pullAll({ force: true });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.pulled, 1);
    assertEquals(result.value.skipped, 0);
  }

  assertEquals(fileWriter.written.has("content/posts/existing-post.md"), true);
});
