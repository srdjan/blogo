import { assertEquals } from "@std/assert";
import { createRouter } from "../../src/http/router.ts";
import type { RouteContext } from "../../src/http/types.ts";

// Helper to create test requests
function createTestRequest(url: string, method = "GET"): Request {
  return new Request(url, { method });
}

Deno.test("Router - handles simple GET route", async () => {
  const router = createRouter()
    .get("/test", async () => new Response("Test response"));

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/test");
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Test response");
});

Deno.test("Router - handles POST route", async () => {
  const router = createRouter()
    .post("/api/data", async () => new Response("Posted"));

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/api/data", "POST");
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Posted");
});

Deno.test("Router - handles PUT route", async () => {
  const router = createRouter()
    .put("/api/data/123", async () => new Response("Updated"));

  const handler = router.handler();
  const request = createTestRequest(
    "http://localhost:8000/api/data/123",
    "PUT",
  );
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Updated");
});

Deno.test("Router - handles DELETE route", async () => {
  const router = createRouter()
    .delete("/api/data/123", async () => new Response("Deleted"));

  const handler = router.handler();
  const request = createTestRequest(
    "http://localhost:8000/api/data/123",
    "DELETE",
  );
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Deleted");
});

Deno.test("Router - handles route parameters", async () => {
  const router = createRouter()
    .get("/posts/:slug", async (ctx: RouteContext) => {
      const url = new URL(ctx.req.url);
      const pathParts = url.pathname.split("/");
      const slug = pathParts[pathParts.length - 1];
      return new Response(`Post: ${slug}`);
    });

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/posts/my-post");
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Post: my-post");
});

Deno.test("Router - handles multiple route parameters", async () => {
  const router = createRouter()
    .get("/users/:userId/posts/:postId", async (ctx: RouteContext) => {
      const url = new URL(ctx.req.url);
      const pathParts = url.pathname.split("/");
      const userId = pathParts[2];
      const postId = pathParts[4];
      return new Response(`User: ${userId}, Post: ${postId}`);
    });

  const handler = router.handler();
  const request = createTestRequest(
    "http://localhost:8000/users/123/posts/456",
  );
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "User: 123, Post: 456");
});

Deno.test("Router - handles regex routes", async () => {
  const router = createRouter()
    .get(/^\/images\/og\/(.+)\.png$/, async (ctx: RouteContext) => {
      const url = new URL(ctx.req.url);
      const match = url.pathname.match(/^\/images\/og\/(.+)\.png$/);
      const slug = match?.[1] || "unknown";
      return new Response(`OG Image for: ${slug}`);
    });

  const handler = router.handler();
  const request = createTestRequest(
    "http://localhost:8000/images/og/my-post.png",
  );
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "OG Image for: my-post");
});

Deno.test("Router - returns 404 for unmatched routes", async () => {
  const router = createRouter()
    .get("/test", async () => new Response("Test"));

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/nonexistent");
  const response = await handler(request);

  assertEquals(response.status, 404);
  assertEquals(await response.text(), "Not Found");
});

Deno.test("Router - matches exact paths", async () => {
  const router = createRouter()
    .get("/test", async () => new Response("Exact match"))
    .get("/test/sub", async () => new Response("Sub path"));

  const handler = router.handler();

  const response1 = await handler(
    createTestRequest("http://localhost:8000/test"),
  );
  assertEquals(response1.status, 200);
  assertEquals(await response1.text(), "Exact match");

  const response2 = await handler(
    createTestRequest("http://localhost:8000/test/sub"),
  );
  assertEquals(response2.status, 200);
  assertEquals(await response2.text(), "Sub path");
});

Deno.test("Router - handles query parameters", async () => {
  const router = createRouter()
    .get("/search", async (ctx: RouteContext) => {
      const query = ctx.searchParams.get("q") || "no query";
      return new Response(`Search: ${query}`);
    });

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/search?q=test");
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Search: test");
});

Deno.test("Router - provides correct context", async () => {
  const router = createRouter()
    .get("/context-test", async (ctx: RouteContext) => {
      const data = {
        pathname: ctx.pathname,
        method: ctx.method,
        hasUrl: !!ctx.url,
        hasReq: !!ctx.req,
        hasSearchParams: !!ctx.searchParams,
      };
      return new Response(JSON.stringify(data));
    });

  const handler = router.handler();
  const request = createTestRequest(
    "http://localhost:8000/context-test?param=value",
  );
  const response = await handler(request);

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.pathname, "/context-test");
  assertEquals(data.method, "GET");
  assertEquals(data.hasUrl, true);
  assertEquals(data.hasReq, true);
  assertEquals(data.hasSearchParams, true);
});

Deno.test("Router - handles route handler errors", async () => {
  const router = createRouter()
    .get("/error", async () => {
      throw new Error("Route handler error");
    });

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/error");
  const response = await handler(request);

  assertEquals(response.status, 500);
  assertEquals(await response.text(), "Internal Server Error");
});

Deno.test("Router - method matching is case sensitive", async () => {
  const router = createRouter()
    .get("/test", async () => new Response("GET response"));

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000/test", "POST");
  const response = await handler(request);

  assertEquals(response.status, 404);
});

Deno.test("Router - supports chaining multiple routes", async () => {
  const router = createRouter()
    .get("/", async () => new Response("Home"))
    .get("/about", async () => new Response("About"))
    .post("/contact", async () => new Response("Contact posted"))
    .put("/update", async () => new Response("Updated"))
    .delete("/delete", async () => new Response("Deleted"));

  const handler = router.handler();

  const tests = [
    { url: "/", method: "GET", expected: "Home" },
    { url: "/about", method: "GET", expected: "About" },
    { url: "/contact", method: "POST", expected: "Contact posted" },
    { url: "/update", method: "PUT", expected: "Updated" },
    { url: "/delete", method: "DELETE", expected: "Deleted" },
  ];

  for (const test of tests) {
    const request = createTestRequest(
      `http://localhost:8000${test.url}`,
      test.method,
    );
    const response = await handler(request);
    assertEquals(response.status, 200);
    assertEquals(await response.text(), test.expected);
  }
});

Deno.test("Router - handles empty path", async () => {
  const router = createRouter()
    .get("/", async () => new Response("Empty path"));

  const handler = router.handler();
  const request = createTestRequest("http://localhost:8000");
  const response = await handler(request);

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Empty path");
});
