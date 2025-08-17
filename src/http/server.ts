import type { Handler, Middleware, ServerOptions } from "./types.ts";

const compose = (handler: Handler, middlewares: readonly Middleware[] = []): Handler =>
  middlewares.reduceRight((next, middleware) => middleware(next), handler);

export function startServer(handler: Handler, options: ServerOptions): Deno.HttpServer {
  const wrapped = compose(handler, [
    requestId(),
    recover(options.onError),
    ...(options.middlewares ?? []),
  ]);

  options.beforeStart?.();
  const { port, hostname = "localhost", signal } = options;
  console.log(`Server listening on http://${hostname}:${port}`);
  
  const serveOptions: Deno.ServeTcpOptions & { signal?: AbortSignal } = { port, hostname };
  if (signal) {
    serveOptions.signal = signal;
  }
  
  return Deno.serve(serveOptions, wrapped);
}

function requestId(): Middleware {
  return (next) => async (req) => {
    const rid = crypto.randomUUID();
    const res = await next(req);
    const headers = new Headers(res.headers);
    headers.set("x-request-id", rid);
    return new Response(res.body, { ...res, headers });
  };
}

function recover(onError?: (e: unknown, req: Request) => Response): Middleware {
  return (next) => async (req) => {
    try {
      return await next(req);
    } catch (e) {
      return onError?.(e, req) ?? 
        new Response("Internal Server Error", { status: 500 });
    }
  };
}