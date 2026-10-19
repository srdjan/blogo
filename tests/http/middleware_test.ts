import { assertEquals, assertExists } from "@std/assert";
import {
  compress,
  createRequestTracking,
  errorBoundary,
  staticFiles,
} from "../../src/http/middleware.ts";
import { createMemoryHealthService } from "../helpers/health_service.ts";
import type { Handler } from "../../src/http/types.ts";

// Helper to create test requests
function createTestRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

// Helper to create test handlers
function createTestHandler(response: Response): Handler {
  return () => Promise.resolve(response);
}

function createErrorHandler(error: Error): Handler {
  return () => Promise.reject(error);
}

Deno.test("errorBoundary middleware - catches and handles errors", async () => {
  const error = new Error("Test error");
  const handler = createErrorHandler(error);
  const middleware = errorBoundary(handler);

  const request = createTestRequest("http://localhost:8000/test");
  const response = await middleware(request);

  assertEquals(response.status, 500);
  assertExists(response.headers.get("x-correlation-id"));
});

Deno.test("errorBoundary middleware - handles NotFound errors", async () => {
  const error = new Error("Not found");
  error.name = "NotFound";
  const handler = createErrorHandler(error);
  const middleware = errorBoundary(handler);

  const request = createTestRequest("http://localhost:8000/test");
  const response = await middleware(request);

  assertEquals(response.status, 404);
});

Deno.test("errorBoundary middleware - handles ValidationError", async () => {
  const error = new Error("Validation failed");
  error.name = "ValidationError";
  const handler = createErrorHandler(error);
  const middleware = errorBoundary(handler);

  const request = createTestRequest("http://localhost:8000/test");
  const response = await middleware(request);

  assertEquals(response.status, 400);
});

Deno.test("errorBoundary middleware - handles AbortError", async () => {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  const handler = createErrorHandler(error);
  const middleware = errorBoundary(handler);

  const request = createTestRequest("http://localhost:8000/test");
  const response = await middleware(request);

  assertEquals(response.status, 504);
});

Deno.test("errorBoundary middleware - passes through successful responses", async () => {
  const handler = createTestHandler(new Response("Success", { status: 200 }));
  const middleware = errorBoundary(handler);

  const request = createTestRequest("http://localhost:8000/test");
  const response = await middleware(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Success");
});

/**
 * Runs `body` with a fresh temp directory. `root` is the public directory
 * (`<temp>/public`) and `parent` is the temp directory above it.
 */
async function withTempRoot(
  files: Record<string, string>,
  body: (
    dirs: { readonly root: string; readonly parent: string },
  ) => Promise<void>,
): Promise<void> {
  const parent = await Deno.makeTempDir({ prefix: "blogo-static-" });
  const root = `${parent}/public`;
  try {
    for (const [relative, content] of Object.entries(files)) {
      const path = `${root}/${relative}`;
      await Deno.mkdir(path.substring(0, path.lastIndexOf("/")), {
        recursive: true,
      });
      await Deno.writeTextFile(path, content);
    }
    await Deno.mkdir(root, { recursive: true });
    await body({ root, parent });
  } finally {
    await Deno.remove(parent, { recursive: true });
  }
}

const notFoundHandler = (): Handler =>
  createTestHandler(new Response("Not found", { status: 404 }));

Deno.test("staticFiles middleware - serves static files", async () => {
  const testContent = "body { color: red; }";
  await withTempRoot({ "test.css": testContent }, async ({ root }) => {
    const middleware = staticFiles(root)(notFoundHandler());
    const response = await middleware(
      createTestRequest("http://localhost:8000/test.css"),
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), "text/css");
    assertEquals(await response.text(), testContent);
  });
});

Deno.test("staticFiles middleware - passes through non-static requests", async () => {
  await withTempRoot({}, async ({ root }) => {
    const handler = createTestHandler(
      new Response("Dynamic content", { status: 200 }),
    );
    const response = await staticFiles(root)(handler)(
      createTestRequest("http://localhost:8000/api/posts"),
    );

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "Dynamic content");
  });
});

Deno.test("staticFiles middleware - handles missing files", async () => {
  await withTempRoot({}, async ({ root }) => {
    const response = await staticFiles(root)(notFoundHandler())(
      createTestRequest("http://localhost:8000/nonexistent.css"),
    );

    assertEquals(response.status, 404);
    assertEquals(await response.text(), "File not found");
  });
});

Deno.test("staticFiles middleware - only handles GET requests", async () => {
  await withTempRoot({ "test.css": "a {}" }, async ({ root }) => {
    const handler = createTestHandler(
      new Response("POST response", { status: 200 }),
    );
    const response = await staticFiles(root)(handler)(
      createTestRequest("http://localhost:8000/test.css", { method: "POST" }),
    );

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "POST response");
  });
});

Deno.test("staticFiles middleware - sets correct content types", async () => {
  const testCases = [
    {
      path: "/js/test.js",
      content: "console.log('test');",
      expectedType: "application/javascript",
    },
    {
      path: "/js/test.json",
      content: '{"test": true}',
      expectedType: "application/json",
    },
    {
      path: "/images/test.svg",
      content: "<svg></svg>",
      expectedType: "image/svg+xml",
    },
    {
      path: "/images/test.png",
      content: "fake-png-data",
      expectedType: "image/png",
    },
  ];
  const files = Object.fromEntries(
    testCases.map((testCase) => [testCase.path.slice(1), testCase.content]),
  );

  await withTempRoot(files, async ({ root }) => {
    for (const testCase of testCases) {
      const response = await staticFiles(root)(notFoundHandler())(
        createTestRequest(`http://localhost:8000${testCase.path}`),
      );
      assertEquals(response.status, 200, testCase.path);
      assertEquals(
        response.headers.get("content-type"),
        testCase.expectedType,
        testCase.path,
      );
      assertEquals(await response.text(), testCase.content);
    }
  });
});

Deno.test("staticFiles middleware - a bare .json path falls through to the next handler", async () => {
  await withTempRoot({ "test.json": "{}" }, async ({ root }) => {
    const response = await staticFiles(root)(notFoundHandler())(
      createTestRequest("http://localhost:8000/test.json"),
    );

    // Current behavior; see plan finding B7
    assertEquals(response.status, 404);
    assertEquals(await response.text(), "Not found");
  });
});

Deno.test("staticFiles middleware - a path with .. does not escape the root", async () => {
  await withTempRoot({}, async ({ root, parent }) => {
    await Deno.writeTextFile(`${parent}/secret.css`, "secret");
    const urls = [
      "http://localhost:8000/css/../../secret.css",
      "http://localhost:8000/css/..%2f..%2fsecret.css",
    ];

    for (const url of urls) {
      const response = await staticFiles(root)(notFoundHandler())(
        createTestRequest(url),
      );
      assertEquals(response.status, 404, url);
      assertEquals(await response.text(), "File not found", url);
    }
  });
});

const bigBody = "a".repeat(2000);

const bodyHandler = (
  body: string,
  headers: Record<string, string> = {},
): Handler =>
(): Response =>
  new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
  });

const gunzip = async (response: Response): Promise<string> => {
  const stream = response.body?.pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
};

Deno.test("compress middleware - gzips a body over minSize", async () => {
  const handler = bodyHandler(bigBody, { "Content-Length": "2000" });
  const response = await compress()(handler)(
    createTestRequest("http://localhost:8000/", {
      headers: { "Accept-Encoding": "gzip" },
    }),
  );

  assertEquals(response.headers.get("Content-Encoding"), "gzip");
  assertEquals(response.headers.get("Content-Length"), null);
  assertEquals(response.headers.get("Vary"), "Accept-Encoding");
  assertEquals(await gunzip(response), bigBody);
});

Deno.test("compress middleware - skips a body under minSize", async () => {
  const handler = bodyHandler("tiny", { "Content-Length": "4" });
  const response = await compress()(handler)(
    createTestRequest("http://localhost:8000/", {
      headers: { "Accept-Encoding": "gzip" },
    }),
  );

  assertEquals(response.headers.get("Content-Encoding"), null);
  assertEquals(await response.text(), "tiny");
});

Deno.test("compress middleware - compresses a small body that has no Content-Length", async () => {
  const response = await compress()(bodyHandler("tiny"))(
    createTestRequest("http://localhost:8000/", {
      headers: { "Accept-Encoding": "gzip" },
    }),
  );

  // Current behavior; see plan finding B8
  assertEquals(response.headers.get("Content-Encoding"), "gzip");
  assertEquals(await gunzip(response), "tiny");
});

Deno.test("compress middleware - skips a request without Accept-Encoding", async () => {
  const handler = bodyHandler(bigBody, { "Content-Length": "2000" });
  const response = await compress()(handler)(
    createTestRequest("http://localhost:8000/"),
  );

  assertEquals(response.headers.get("Content-Encoding"), null);
  assertEquals(await response.text(), bigBody);
});

Deno.test("createRequestTracking - reports one metrics update per request", async () => {
  const cases = [
    { status: 200, isError: false },
    { status: 404, isError: true },
  ];

  for (const { status, isError } of cases) {
    const health = createMemoryHealthService();
    const handler = createTestHandler(new Response("body", { status }));
    const response = await createRequestTracking(health)(handler)(
      createTestRequest("http://localhost:8000/"),
    );

    assertEquals(health.metricCalls.length, 1, `status ${status}`);
    assertEquals(health.metricCalls[0]?.isError, isError, `status ${status}`);
    assertEquals(typeof health.metricCalls[0]?.responseTime, "number");
    assertExists(response.headers.get("x-correlation-id"));
    await response.text();
  }
});
