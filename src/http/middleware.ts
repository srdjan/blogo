import type { Middleware } from "./types.ts";

export const accessLog: Middleware = (next) => async (req) => {
  const start = performance.now();
  const res = await next(req);
  const duration = (performance.now() - start).toFixed(1);
  console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} ${duration}ms`);
  return res;
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
} = {}): Middleware => (next) => async (req) => {
  const response = await next(req);
  const headers = new Headers(response.headers);
  
  headers.set("Access-Control-Allow-Origin", options.origin ?? "*");
  headers.set("Access-Control-Allow-Methods", options.methods?.join(", ") ?? "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", options.headers?.join(", ") ?? "Content-Type, Authorization");
  
  return new Response(response.body, { ...response, headers });
};

export const staticFiles = (publicDir: string): Middleware => (next) => async (req) => {
  const url = new URL(req.url);
  
  if (req.method !== "GET") {
    return next(req);
  }

  const isStaticFile = url.pathname.startsWith("/css/") ||
                      url.pathname.startsWith("/js/") ||
                      url.pathname.startsWith("/images/") ||
                      url.pathname === "/favicon.svg" ||
                      url.pathname === "/favicon.ico" ||
                      url.pathname === "/manifest.json" ||
                      /\.(jpg|jpeg|png|gif|svg|ico|css|js|wav|mp3|ogg|flac|m4a|aac)$/.test(url.pathname);

  if (!isStaticFile) {
    return next(req);
  }

  try {
    const filePath = `${publicDir}${url.pathname}`;
    const file = await Deno.readFile(filePath);
    const contentType = getContentType(filePath);

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
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
    wav: "audio/wav",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
  };

  return contentTypes[ext ?? ""] ?? "text/plain";
}