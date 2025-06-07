import { logger } from "./utils.ts";

// deno-lint-ignore no-explicit-any
export const loggerMiddleware = async (ctx: any, next: () => Promise<void>) => {
  const start = performance.now();
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  logger.info(`${ctx.request.method} ${path}`);

  try {
    await next();
  } catch (error) {
    logger.error("Unhandled error:", error);
    throw error;
  } finally {
    const duration = performance.now() - start;
    logger.info(`Request processed in ${duration.toFixed(2)}ms`);
  }
};

// deno-lint-ignore no-explicit-any
export const corsMiddleware = async (ctx: any, next: () => Promise<void>) => {
  const url = new URL(ctx.request.url);

  // Handle CORS for API endpoints
  if (url.pathname.startsWith("/api/")) {
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    ctx.response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    ctx.response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    // Handle preflight requests
    if (ctx.request.method === "OPTIONS") {
      ctx.response = new Response(null, { status: 204 });
      return;
    }
  }

  await next();
};

// Simplified debug middleware that only logs request details
// deno-lint-ignore no-explicit-any
export const debugMiddleware = async (ctx: any, next: () => Promise<void>) => {
  if (Deno.env.get("DENO_ENV") === "development") {
    const url = new URL(ctx.request.url);
    logger.debug(`${ctx.request.method} ${url.pathname}${url.search}`);
    logger.debug(
      `Headers: ${
        JSON.stringify(Object.fromEntries(ctx.request.headers.entries()))
      }`,
    );
  }

  await next();
};
