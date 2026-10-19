import type { SiteConfig } from "../domain/config.ts";
import type { LayoutProps } from "../lib/types.ts";
import { assertNever } from "../lib/result.ts";
import { renderLayout } from "../components/Layout.tsx";
import { renderVNode } from "./render-vnode.ts";
import type { RouteContext } from "./types.ts";

type HeaderMap = Readonly<Record<string, string>>;

export type View =
  | {
    readonly kind: "page";
    readonly props: LayoutProps;
    readonly status: 200 | 400 | 500;
  }
  | {
    readonly kind: "fragment";
    readonly html: string;
    readonly headers: HeaderMap;
  }
  | {
    readonly kind: "text";
    readonly body: string;
    readonly status: number;
    readonly headers?: HeaderMap;
  }
  | {
    readonly kind: "xml";
    readonly body: string;
    readonly contentType: string;
  }
  | { readonly kind: "svg"; readonly body: string }
  | {
    readonly kind: "json";
    readonly body: unknown;
    readonly status: 200 | 503;
  };

export type ViewHandler = (ctx: RouteContext) => Promise<View> | View;

export type ViewDependencies = {
  readonly site: SiteConfig;
  readonly isProd: boolean;
};

export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const PLAIN_CONTENT_TYPE = "text/plain; charset=utf-8";
export const RSS_CONTENT_TYPE = "application/rss+xml; charset=utf-8";
export const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
export const NOINDEX = "noindex, nofollow";

const ASSET_CACHE = "max-age=3600";

export const pageView = (
  props: LayoutProps,
  status: 200 | 400 | 500 = 200,
): View => ({ kind: "page", props, status });

export const textView = (body: string, status: number): View => ({
  kind: "text",
  body,
  status,
});

// htmx 4 marks body-targeted requests (including history restore) as "full".
// Those need the whole page, not a fragment.
export const isHtmxRequest = (req: Request): boolean =>
  req.headers.get("HX-Request") === "true" &&
  req.headers.get("HX-Request-Type") !== "full";

const htmlCacheHeaders = (isProd: boolean): HeaderMap =>
  isProd
    ? { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }
    : {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    };

export const renderPageBody = (
  props: LayoutProps,
  ctx: RouteContext,
  site: SiteConfig,
): string =>
  isHtmxRequest(ctx.req)
    ? renderVNode(props.children)
    : renderLayout(props, site);

export const htmlResponse = (
  body: string,
  isProd: boolean,
  status = 200,
  extraHeaders: HeaderMap = {},
): Response =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": HTML_CONTENT_TYPE,
      ...htmlCacheHeaders(isProd),
      "Vary": "HX-Request, HX-Request-Type",
      ...extraHeaders,
    },
  });

export const toResponse = (
  view: View,
  ctx: RouteContext,
  deps: ViewDependencies,
): Response => {
  switch (view.kind) {
    case "page":
      return htmlResponse(
        renderPageBody(view.props, ctx, deps.site),
        deps.isProd,
        view.status,
      );
    case "fragment":
      return new Response(view.html, {
        headers: { "Content-Type": HTML_CONTENT_TYPE, ...view.headers },
      });
    case "text":
      return view.headers
        ? new Response(view.body, {
          status: view.status,
          headers: view.headers,
        })
        : new Response(view.body, { status: view.status });
    case "xml":
      return new Response(view.body, {
        headers: {
          "Content-Type": view.contentType,
          "Cache-Control": ASSET_CACHE,
        },
      });
    case "svg":
      return new Response(view.body, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": ASSET_CACHE,
        },
      });
    case "json":
      return new Response(JSON.stringify(view.body, null, 2), {
        status: view.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Robots-Tag": NOINDEX,
        },
      });
  }
  return assertNever(view);
};
