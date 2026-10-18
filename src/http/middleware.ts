import type { Middleware } from "./types.ts";
import type { HealthService } from "../domain/health.ts";
import { generateRequestId } from "../utils.ts";

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
      const isFingerprinted = /\.[a-f0-9]{16}\.\w+$/.test(url.pathname);
      const cacheControl = isFingerprinted
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";
      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
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

// Combined request tracking: request ID, correlation ID, access log, perf monitoring
export const createRequestTracking =
  (healthService: HealthService): Middleware => (next) => async (req) => {
    const id = generateRequestId();
    const start = performance.now();
    const url = new URL(req.url);

    // Single Request construction with both IDs
    const enhancedReq = new Request(req, {
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        "x-request-id": id,
        "x-correlation-id": id,
      },
    });

    try {
      const res = await next(enhancedReq);
      const duration = performance.now() - start;

      // Update health metrics
      healthService.updateMetrics(duration, res.status >= 400);

      // Log slow requests inline (>1000ms)
      if (duration > 1000) {
        console.warn(JSON.stringify({
          correlationId: id,
          method: req.method,
          path: url.pathname,
          duration: `${duration.toFixed(1)}ms`,
          timestamp: new Date().toISOString(),
          level: "WARN",
          type: "SLOW_REQUEST",
        }));
      }

      // Mutate response headers directly instead of creating new Response
      res.headers.set("x-correlation-id", id);
      return res;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(JSON.stringify({
        correlationId: id,
        method: req.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration.toFixed(1)}ms`,
        timestamp: new Date().toISOString(),
        level: "ERROR",
      }));
      throw error;
    }
  };
