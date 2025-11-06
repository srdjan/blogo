export type Handler = (req: Request) => Promise<Response> | Response;
export type Middleware = (next: Handler) => Handler;

export type ServerOptions = {
  readonly port: number;
  readonly hostname?: string;
  readonly beforeStart?: () => Promise<void> | void;
  readonly onError?: (e: unknown, req: Request) => Response;
  readonly middlewares?: readonly Middleware[];
  readonly signal?: AbortSignal;
};

export type RouteContext = {
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  readonly method: string;
  readonly url: URL;
  readonly req: Request;
};

export type RouteHandler = (ctx: RouteContext) => Promise<Response> | Response;

export type Route = {
  readonly method: string;
  readonly pattern: string | RegExp;
  readonly handler: RouteHandler;
};

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type RouteMatch = {
  readonly route: Route;
  readonly params: Record<string, string>;
};
