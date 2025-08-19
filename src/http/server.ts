import type { Handler, Middleware, ServerOptions } from "./types.ts";
import { errorBoundary, performanceMonitoring } from "./middleware.ts";

const compose = (
  handler: Handler,
  middlewares: readonly Middleware[] = [],
): Handler =>
  middlewares.reduceRight((next, middleware) => middleware(next), handler);

// Generate request ID for tracing
const requestId = (): Middleware => (next) => async (req) => {
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const enhancedReq = new Request(req, {
    headers: {
      ...Object.fromEntries(req.headers.entries()),
      "x-request-id": id,
    },
  });
  return await next(enhancedReq);
};

// Enhanced error recovery with structured logging
const recover =
  (onError?: (error: unknown, req: Request) => Response): Middleware =>
  (next) =>
  async (req) => {
    try {
      return await next(req);
    } catch (error) {
      const correlationId = req.headers.get("x-correlation-id") || "unknown";

      // Log the error with context
      const errorLog = {
        correlationId,
        requestId: req.headers.get("x-request-id") || "unknown",
        method: req.method,
        url: req.url,
        error: error instanceof Error
          ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
          : String(error),
        timestamp: new Date().toISOString(),
        level: "ERROR",
        type: "SERVER_ERROR",
      };

      console.error(JSON.stringify(errorLog));

      if (onError) {
        return onError(error, req);
      }

      return new Response("Internal Server Error", {
        status: 500,
        headers: { "x-correlation-id": correlationId },
      });
    }
  };

export function startServer(
  handler: Handler,
  options: ServerOptions,
): Deno.HttpServer {
  const wrapped = compose(handler, [
    errorBoundary,
    performanceMonitoring,
    requestId(),
    recover(options.onError),
    ...(options.middlewares ?? []),
  ]);

  options.beforeStart?.();
  const { port, hostname = "localhost", signal } = options;
  console.log(`Server listening on http://${hostname}:${port}`);

  const serveOptions: Deno.ServeTcpOptions & { signal?: AbortSignal } = {
    port,
    hostname,
  };
  if (signal) {
    serveOptions.signal = signal;
  }

  return Deno.serve(serveOptions, wrapped);
}
