import type { Middleware } from "./types.ts";
import type { HealthService } from "../domain/health.ts";
import { generateRequestId } from "../utils.ts";

// Enhanced access logging with correlation IDs and structured data
export const createAccessLog =
  (healthService: HealthService): Middleware => (next) => async (req) => {
    const correlationId = generateRequestId();
    const start = performance.now();
    const url = new URL(req.url);

    // Add correlation ID to request headers for downstream services
    const enhancedReq = new Request(req, {
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        "x-correlation-id": correlationId,
      },
    });

    try {
      const res = await next(enhancedReq);
      const duration = (performance.now() - start).toFixed(1);

      // Structured logging
      const _logData = {
        correlationId,
        method: req.method,
        path: url.pathname,
        query: url.search,
        status: res.status,
        duration: `${duration}ms`,
        userAgent: req.headers.get("user-agent") || "unknown",
        timestamp: new Date().toISOString(),
      };

      // Update request metrics
      healthService.updateMetrics(parseFloat(duration), res.status >= 400);

      // Add correlation ID to response headers
      const headers = new Headers(res.headers);
      headers.set("x-correlation-id", correlationId);

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (error) {
      const duration = (performance.now() - start).toFixed(1);

      // Log error with correlation ID
      const errorLogData = {
        correlationId,
        method: req.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        level: "ERROR",
      };

      console.error(JSON.stringify(errorLogData));
      throw error;
    }
  };

export const timeout = (ms: number): Middleware => (next) => async (req) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  try {
    const modifiedReq = new Request(req, { signal: controller.signal });
    return await next(modifiedReq);
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      return new Response("Request Timeout", { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const cors = (options: {
  readonly origin?: string;
  readonly methods?: readonly string[];
  readonly headers?: readonly string[];
} = {}): Middleware =>
(next) =>
async (req) => {
  const response = await next(req);
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
  );
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  headers.set("Access-Control-Allow-Origin", options.origin ?? "*");
  headers.set(
    "Access-Control-Allow-Methods",
    options.methods?.join(", ") ?? "GET, POST, PUT, DELETE, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    options.headers?.join(", ") ?? "Content-Type, Authorization",
  );

  return new Response(response.body, { ...response, headers });
};

export const staticFiles =
  (publicDir: string): Middleware => (next) => async (req) => {
    const url = new URL(req.url);

    if (req.method !== "GET" && req.method !== "HEAD") {
      return next(req);
    }

    const isStaticFile = url.pathname.startsWith("/css/") ||
      url.pathname.startsWith("/js/") ||
      url.pathname.startsWith("/images/") ||
      url.pathname.startsWith("/fonts/") ||
      url.pathname === "/favicon.svg" ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/manifest.json" ||
      /\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot|wav|mp3|ogg|flac|m4a|aac)$/
        .test(
          url.pathname,
        );

    if (!isStaticFile) {
      return next(req);
    }

    try {
      const filePath = `${publicDir}${url.pathname}`;
      const info = await Deno.stat(filePath);
      if (!info.isFile) {
        return new Response("File not found", { status: 404 });
      }

      const contentType = getContentType(filePath);
      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Content-Length": info.size.toString(),
      });

      if (info.mtime) {
        headers.set("Last-Modified", info.mtime.toUTCString());
        const ims = req.headers.get("if-modified-since");
        if (ims) {
          const imsDate = new Date(ims);
          if (!Number.isNaN(imsDate.getTime())) {
            const mtimeSeconds = Math.floor(info.mtime.getTime() / 1000);
            const imsSeconds = Math.floor(imsDate.getTime() / 1000);
            if (mtimeSeconds <= imsSeconds) {
              return new Response(null, { status: 304, headers });
            }
          }
        }
      }

      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }

      const file = await Deno.readFile(filePath);
      return new Response(file, { headers });
    } catch {
      return new Response("File not found", { status: 404 });
    }
  };

const shouldCompress = (contentType: string): boolean => {
  if (!contentType) return false;
  if (contentType.startsWith("text/")) return true;
  return [
    "application/javascript",
    "application/json",
    "application/rss+xml",
    "application/atom+xml",
    "application/xml",
    "text/xml",
    "text/css",
    "image/svg+xml",
  ].some((type) => contentType.startsWith(type));
};

// Response compression middleware for text-based assets and HTML
export const compress = (
  options: { readonly minSize?: number } = {},
): Middleware =>
(next) =>
async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return await next(req);
  }

  const res = await next(req);
  if (!res.body) return res;

  const existingEncoding = res.headers.get("content-encoding");
  if (existingEncoding && existingEncoding !== "identity") {
    return res;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!shouldCompress(contentType)) {
    return res;
  }

  const minSize = options.minSize ?? 512;
  const length = res.headers.get("content-length");
  if (length && Number(length) < minSize) {
    return res;
  }

  const accept = req.headers.get("accept-encoding") ?? "";
  const encoding = accept.includes("gzip")
    ? "gzip"
    : accept.includes("deflate")
    ? "deflate"
    : null;

  if (!encoding) {
    return res;
  }

  const headers = new Headers(res.headers);
  headers.set("Content-Encoding", encoding);
  headers.delete("Content-Length");

  const vary = headers.get("Vary");
  if (!vary) {
    headers.set("Vary", "Accept-Encoding");
  } else if (!vary.toLowerCase().includes("accept-encoding")) {
    headers.set("Vary", `${vary}, Accept-Encoding`);
  }

  if (req.method === "HEAD") {
    return new Response(null, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  const stream = res.body.pipeThrough(
    new CompressionStream(encoding as CompressionFormat),
  );
  return new Response(stream, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

// ETag support for HTML responses to enable conditional requests (GET/HEAD only)
export const etag: Middleware = (next) => async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return await next(req);
  }

  const res = await next(req);

  if (res.status !== 200 || !res.body) {
    return res;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("text/html")) {
    return res;
  }

  const body = new Uint8Array(await res.arrayBuffer());
  const hash = hashBytes(body);
  const etagValue = `W/"${hash}-${body.byteLength}"`;

  const headers = new Headers(res.headers);
  headers.set("ETag", etagValue);

  const ifNoneMatch = req.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    ifNoneMatch.split(/\s*,\s*/).includes(etagValue)
  ) {
    return new Response(null, { status: 304, headers });
  }

  if (req.method === "HEAD") {
    return new Response(null, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

const hashBytes = (bytes: Uint8Array): string => {
  // FNV-1a 32-bit hash for stable, fast ETag generation
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
};

function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
  };

  return contentTypes[ext ?? ""] ?? "text/plain";
}

// Error boundary middleware for comprehensive error handling
export const errorBoundary: Middleware = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    const correlationId = req.headers.get("x-correlation-id") || "unknown";
    const url = new URL(req.url);

    // Structured error logging
    const errorLog = {
      correlationId,
      method: req.method,
      path: url.pathname,
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
      level: "ERROR",
      type: "UNHANDLED_ERROR",
    };

    console.error(JSON.stringify(errorLog));

    // Return appropriate error response based on error type
    if (error instanceof Error) {
      if (error.name === "NotFound") {
        return new Response("Not Found", {
          status: 404,
          headers: { "x-correlation-id": correlationId },
        });
      }

      if (error.name === "ValidationError") {
        return new Response("Bad Request", {
          status: 400,
          headers: { "x-correlation-id": correlationId },
        });
      }

      if (error.name === "AbortError") {
        return new Response("Request Timeout", {
          status: 504,
          headers: { "x-correlation-id": correlationId },
        });
      }
    }

    // Default to 500 for unhandled errors
    return new Response("Internal Server Error", {
      status: 500,
      headers: { "x-correlation-id": correlationId },
    });
  }
};

// Performance monitoring middleware
export const performanceMonitoring: Middleware = (next) => async (req) => {
  const start = performance.now();
  const memoryBefore =
    (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      ?.usedJSHeapSize;

  const response = await next(req);

  const duration = performance.now() - start;
  const memoryAfter =
    (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      ?.usedJSHeapSize;
  const correlationId = req.headers.get("x-correlation-id") || "unknown";

  // Log performance metrics for slow requests (>1000ms)
  if (duration > 1000) {
    const perfLog = {
      correlationId,
      method: req.method,
      path: new URL(req.url).pathname,
      duration: `${duration.toFixed(2)}ms`,
      memoryDelta: memoryBefore && memoryAfter
        ? `${((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2)}MB`
        : "unknown",
      timestamp: new Date().toISOString(),
      level: "WARN",
      type: "SLOW_REQUEST",
    };
    console.warn(JSON.stringify(perfLog));
  }

  return response;
};
