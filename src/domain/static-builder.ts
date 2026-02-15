import type { AppResult } from "../lib/types.ts";
import { ok } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import type { ContentService } from "./content.ts";
import type { FileWriter } from "../ports/writer.ts";
import type { Logger } from "../ports/logger.ts";
import type { RouteHandlers } from "../http/routes.tsx";
import type { RouteContext } from "../http/types.ts";

export type BuildOptions = {
  readonly outputDir: string;
  readonly baseUrl: string;
};

export type BuildReport = {
  readonly pages: number;
  readonly fragments: number;
  readonly assets: number;
  readonly errors: readonly string[];
};

export interface StaticBuilder {
  readonly build: (options: BuildOptions) => Promise<AppResult<BuildReport>>;
}

export type StaticBuilderDependencies = {
  readonly contentService: ContentService;
  readonly routes: RouteHandlers;
  readonly fileWriter: FileWriter;
  readonly logger: Logger;
  readonly publicDir: string;
};

export const createStaticBuilder = (
  deps: StaticBuilderDependencies,
): StaticBuilder => {
  const { contentService, routes, fileWriter, logger, publicDir } = deps;

  const synthesizeContext = (
    path: string,
    baseUrl: string,
    htmx: boolean,
  ): RouteContext => {
    const url = new URL(path, baseUrl);
    const headers = new Headers();
    if (htmx) headers.set("HX-Request", "true");
    const req = new Request(url.toString(), { headers });

    return {
      pathname: url.pathname,
      searchParams: url.searchParams,
      method: "GET",
      url,
      req,
    };
  };

  const renderRoute = async (
    handler: (ctx: RouteContext) => Promise<Response> | Response,
    path: string,
    baseUrl: string,
    htmx: boolean,
  ): Promise<string> => {
    const ctx = synthesizeContext(path, baseUrl, htmx);
    const response = await handler(ctx);
    return response.text();
  };

  const isHtmlRoute = (path: string): boolean => {
    const nonHtml = [
      "/feed.xml",
      "/rss.xml",
      "/sitemap.xml",
      "/robots.txt",
      ".svg",
    ];
    return !nonHtml.some((ext) => path.endsWith(ext));
  };

  const rewriteHtmxUrls = (html: string): string => {
    // Rewrite hx-get="/path" to hx-get="/path/fragment.html"
    // Rewrite hx-get="/" to hx-get="/fragment.html"
    return html
      .replace(
        /hx-get="\/"/g,
        'hx-get="/fragment.html"',
      )
      .replace(
        /hx-get="(\/[^"]+?)"/g,
        (_match, path: string) => {
          if (path.endsWith("/fragment.html")) return `hx-get="${path}"`;
          return `hx-get="${path}/fragment.html"`;
        },
      );
  };

  const outputPath = (dir: string, routePath: string): string => {
    if (routePath === "/") return `${dir}/index.html`;
    if (routePath.endsWith(".xml")) return `${dir}${routePath}`;
    if (routePath.endsWith(".txt")) return `${dir}${routePath}`;
    if (routePath.endsWith(".svg")) return `${dir}${routePath}`;
    return `${dir}${routePath}/index.html`;
  };

  const fragmentPath = (dir: string, routePath: string): string => {
    if (routePath === "/") return `${dir}/fragment.html`;
    return `${dir}${routePath}/fragment.html`;
  };

  const build = async (
    options: BuildOptions,
  ): Promise<AppResult<BuildReport>> => {
    const { outputDir, baseUrl } = options;
    let pages = 0;
    let fragments = 0;
    let assets = 0;
    const errors: string[] = [];

    // 1. Clean output directory
    logger.info(`Cleaning ${outputDir}/`);
    const cleanResult = await fileWriter.clean(outputDir);
    if (!cleanResult.ok) {
      return cleanResult;
    }

    const ensureResult = await fileWriter.ensureDir(outputDir);
    if (!ensureResult.ok) {
      return ensureResult;
    }

    // 2. Copy public/ to output directory
    logger.info(`Copying ${publicDir}/ to ${outputDir}/`);
    const copyResult = await fileWriter.copyDir(publicDir, outputDir);
    if (!copyResult.ok) {
      return copyResult;
    }
    assets++;

    // 3. Load content data for route enumeration
    const postsResult = await contentService.loadPosts();
    if (!postsResult.ok) {
      return postsResult;
    }
    const posts = postsResult.value;

    const tagsResult = await contentService.getTags();
    if (!tagsResult.ok) {
      return tagsResult;
    }
    const tags = tagsResult.value;

    // 4. Build route list
    type RouteEntry = {
      readonly path: string;
      readonly handler: (
        ctx: RouteContext,
      ) => Promise<Response> | Response;
      readonly html: boolean;
    };

    const routeEntries: RouteEntry[] = [
      // Fixed HTML routes
      { path: "/", handler: routes.home, html: true },
      { path: "/about", handler: routes.about, html: true },
      { path: "/tags", handler: routes.tags, html: true },
      { path: "/rss", handler: routes.rssPage, html: true },
      { path: "/search", handler: routes.search, html: true },

      // Non-HTML routes
      { path: "/feed.xml", handler: routes.rss, html: false },
      { path: "/rss.xml", handler: routes.rss, html: false },
      { path: "/sitemap.xml", handler: routes.sitemap, html: false },
      { path: "/robots.txt", handler: routes.robots, html: false },
      {
        path: "/images/og-default.svg",
        handler: routes.ogImageDefault,
        html: false,
      },
      {
        path: "/.well-known/site.standard.publication",
        handler: routes.atprotoVerification,
        html: false,
      },
    ];

    // Per-post routes
    for (const post of posts) {
      routeEntries.push({
        path: `/posts/${post.slug as string}`,
        handler: routes.post,
        html: true,
      });
      routeEntries.push({
        path: `/images/og/${post.slug as string}.svg`,
        handler: routes.ogImagePost,
        html: false,
      });
    }

    // Per-tag routes
    for (const tag of tags) {
      routeEntries.push({
        path: `/tags/${encodeURIComponent(tag.name as string)}`,
        handler: routes.tagPosts,
        html: true,
      });
    }

    // 5. Render all routes
    for (const entry of routeEntries) {
      try {
        // Full page render
        const content = await renderRoute(
          entry.handler,
          entry.path,
          baseUrl,
          false,
        );

        const outFile = outputPath(outputDir, entry.path);
        const fullContent = entry.html ? rewriteHtmxUrls(content) : content;
        const writeResult = await fileWriter.writeFile(outFile, fullContent);

        if (writeResult.ok) {
          pages++;
          logger.debug(`Generated: ${outFile}`);
        } else {
          errors.push(`${entry.path}: ${writeResult.error.message}`);
        }

        // Fragment render for HTML routes
        if (entry.html) {
          const frag = await renderRoute(
            entry.handler,
            entry.path,
            baseUrl,
            true,
          );
          const fragFile = fragmentPath(outputDir, entry.path);
          const fragResult = await fileWriter.writeFile(fragFile, frag);

          if (fragResult.ok) {
            fragments++;
          } else {
            errors.push(
              `${entry.path} (fragment): ${fragResult.error.message}`,
            );
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${entry.path}: ${msg}`);
        logger.error(`Failed to render ${entry.path}`, e);
      }
    }

    logger.info(
      `Build complete: ${pages} pages, ${fragments} fragments, ${errors.length} errors`,
    );

    return ok({ pages, fragments, assets, errors });
  };

  return { build };
};
