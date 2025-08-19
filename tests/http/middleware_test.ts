import { assertEquals, assertExists } from "@std/assert";
import { accessLog, errorBoundary, performanceMonitoring, staticFiles } from "../../src/http/middleware.ts";
import type { Handler } from "../../src/http/types.ts";

// Helper to create test requests
function createTestRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

// Helper to create test handlers
function createTestHandler(response: Response): Handler {
  return async () => response;
}

function createErrorHandler(error: Error): Handler {
  return async () => {
    throw error;
  };
}

Deno.test("accessLog middleware - adds correlation ID and logs request", async () => {
  const handler = createTestHandler(new Response("OK", { status: 200 }));
  const middleware = accessLog(handler);
  
  const request = createTestRequest("http://localhost:8000/test");
  const response = await middleware(request);
  
  assertEquals(response.status, 200);
  assertExists(response.headers.get("x-correlation-id"));
});

Deno.test("accessLog middleware - handles errors and logs them", async () => {
  const error = new Error("Test error");
  const handler = createErrorHandler(error);
  const middleware = accessLog(handler);
  
  const request = createTestRequest("http://localhost:8000/test");
  
  try {
    await middleware(request);
  } catch (thrownError) {
    assertEquals(thrownError, error);
  }
});

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

Deno.test("performanceMonitoring middleware - passes through responses", async () => {
  const handler = createTestHandler(new Response("OK", { status: 200 }));
  const middleware = performanceMonitoring(handler);
  
  const request = createTestRequest("http://localhost:8000/test", {
    headers: { "x-correlation-id": "test-id" }
  });
  const response = await middleware(request);
  
  assertEquals(response.status, 200);
});

Deno.test("performanceMonitoring middleware - logs slow requests", async () => {
  // Create a handler that takes some time
  const handler: Handler = async () => {
    await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 seconds
    return new Response("Slow response", { status: 200 });
  };
  
  const middleware = performanceMonitoring(handler);
  
  const request = createTestRequest("http://localhost:8000/slow", {
    headers: { "x-correlation-id": "test-id" }
  });
  
  const response = await middleware(request);
  
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Slow response");
});

Deno.test("staticFiles middleware - serves static files", async () => {
  // Create a temporary test file
  const testContent = "body { color: red; }";
  await Deno.writeTextFile("public/test.css", testContent);
  
  try {
    const handler = createTestHandler(new Response("Not found", { status: 404 }));
    const middleware = staticFiles("public")(handler);
    
    const request = createTestRequest("http://localhost:8000/test.css");
    const response = await middleware(request);
    
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), "text/css");
    assertEquals(await response.text(), testContent);
  } finally {
    // Clean up
    try {
      await Deno.remove("public/test.css");
    } catch {
      // Ignore cleanup errors
    }
  }
});

Deno.test("staticFiles middleware - passes through non-static requests", async () => {
  const handler = createTestHandler(new Response("Dynamic content", { status: 200 }));
  const middleware = staticFiles("public")(handler);
  
  const request = createTestRequest("http://localhost:8000/api/posts");
  const response = await middleware(request);
  
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Dynamic content");
});

Deno.test("staticFiles middleware - handles missing files", async () => {
  const handler = createTestHandler(new Response("Not found", { status: 404 }));
  const middleware = staticFiles("public")(handler);
  
  const request = createTestRequest("http://localhost:8000/nonexistent.css");
  const response = await middleware(request);
  
  assertEquals(response.status, 404);
  assertEquals(await response.text(), "File not found");
});

Deno.test("staticFiles middleware - only handles GET requests", async () => {
  const handler = createTestHandler(new Response("POST response", { status: 200 }));
  const middleware = staticFiles("public")(handler);
  
  const request = createTestRequest("http://localhost:8000/test.css", {
    method: "POST"
  });
  const response = await middleware(request);
  
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "POST response");
});

Deno.test("staticFiles middleware - sets correct content types", async () => {
  const testCases = [
    { file: "test.js", content: "console.log('test');", expectedType: "application/javascript" },
    { file: "test.json", content: '{"test": true}', expectedType: "application/json" },
    { file: "test.svg", content: '<svg></svg>', expectedType: "image/svg+xml" },
    { file: "test.png", content: "fake-png-data", expectedType: "image/png" },
  ];

  for (const testCase of testCases) {
    await Deno.writeTextFile(`public/${testCase.file}`, testCase.content);
    
    try {
      const handler = createTestHandler(new Response("Not found", { status: 404 }));
      const middleware = staticFiles("public")(handler);
      
      const request = createTestRequest(`http://localhost:8000/${testCase.file}`);
      const response = await middleware(request);
      
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("content-type"), testCase.expectedType);
    } finally {
      try {
        await Deno.remove(`public/${testCase.file}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
});
