import type {
  Handler,
  HttpMethod,
  Route,
  RouteContext,
  RouteHandler,
  RouteMatch,
} from "./types.ts";

export class Router {
  private readonly routes: Route[] = [];

  get(pattern: string | RegExp, handler: RouteHandler): this {
    return this.add("GET", pattern, handler);
  }

  post(pattern: string | RegExp, handler: RouteHandler): this {
    return this.add("POST", pattern, handler);
  }

  put(pattern: string | RegExp, handler: RouteHandler): this {
    return this.add("PUT", pattern, handler);
  }

  delete(pattern: string | RegExp, handler: RouteHandler): this {
    return this.add("DELETE", pattern, handler);
  }

  add(
    method: HttpMethod,
    pattern: string | RegExp,
    handler: RouteHandler,
  ): this {
    this.routes.push({ method, pattern, handler });
    return this;
  }

  private matchRoute(method: string, pathname: string): RouteMatch | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params: Record<string, string> = {};

      if (typeof route.pattern === "string") {
        if (route.pattern === pathname) {
          return { route, params };
        }

        const paramPattern = route.pattern.replace(/:([^/]+)/g, "([^/]+)");
        const regex = new RegExp(`^${paramPattern}$`);
        const match = pathname.match(regex);

        if (match) {
          const paramNames = [...route.pattern.matchAll(/:([^/]+)/g)].map((m) =>
            m[1]
          ).filter((name): name is string => name !== undefined);
          paramNames.forEach((name, index) => {
            const value = match[index + 1];
            if (value !== undefined) {
              params[name] = value;
            }
          });
          return { route, params };
        }
      } else {
        const match = pathname.match(route.pattern);
        if (match) {
          match.slice(1).forEach((value, index) => {
            params[index.toString()] = value;
          });
          return { route, params };
        }
      }
    }

    return null;
  }

  handler(): Handler {
    return async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const routeMatch = this.matchRoute(req.method, url.pathname);

      if (!routeMatch) {
        return new Response("Not Found", { status: 404 });
      }

      const context: RouteContext = {
        pathname: url.pathname,
        searchParams: url.searchParams,
        method: req.method,
        url,
        req,
      };

      try {
        return await routeMatch.route.handler(context);
      } catch (error) {
        console.error("Route handler error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    };
  }
}

export const createRouter = (): Router => new Router();
