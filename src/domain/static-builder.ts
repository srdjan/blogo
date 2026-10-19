import type { AppError, AppResult } from "../lib/types.ts";
import { err, ok } from "../lib/result.ts";
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
  readonly atprotoEnabled: boolean;
};

type RouteKind = "page" | "asset";

type RouteEntry = {
  readonly path: string;
  readonly handler: (
    ctx: RouteContext,
  ) => Promise<Response> | Response;
  readonly kind: RouteKind;
};

export const createStaticBuilder = (
  deps: StaticBuilderDependencies,
): StaticBuilder => {
  const {
    contentService,
    routes,
    fileWriter,
    logger,
    publicDir,
    atprotoEnabled,
  } = deps;

  const synthesizeContext = (
    path: string,
    baseUrl: string,
    htmx: boolean,
  ): RouteContext => {
    const url = new URL(path, baseUrl);
    const headers = new Headers();
    if (htmx) {
      headers.set("HX-Request", "true");
      headers.set("HX-Request-Type", "partial");
    }
    const req = new Request(url.toString(), { headers });

    return {
      pathname: url.pathname,
      searchParams: url.searchParams,
      method: "GET",
      url,
      req,
    };
  };

  type RenderedRoute = {
    readonly status: number;
    readonly body: string;
  };

  const isSuccess = (status: number): boolean => status >= 200 && status < 300;

  const renderRoute = async (
    handler: (ctx: RouteContext) => Promise<Response> | Response,
    path: string,
    baseUrl: string,
    htmx: boolean,
  ): Promise<RenderedRoute> => {
    const ctx = synthesizeContext(path, baseUrl, htmx);
    const response = await handler(ctx);
    return { status: response.status, body: await response.text() };
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

  const outputPath = (
    dir: string,
    routePath: string,
    kind: RouteKind,
  ): string => {
    if (kind === "asset") return `${dir}${routePath}`;
    if (routePath === "/") return `${dir}/index.html`;
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
    const routeEntries: RouteEntry[] = [
      // Fixed HTML routes
      { path: "/", handler: routes.home, kind: "page" },
      { path: "/about", handler: routes.about, kind: "page" },
      { path: "/tags", handler: routes.tags, kind: "page" },
      { path: "/rss", handler: routes.rssPage, kind: "page" },
      { path: "/search", handler: routes.search, kind: "page" },

      // Non-HTML routes
      { path: "/feed.xml", handler: routes.rss, kind: "asset" },
      { path: "/rss.xml", handler: routes.rss, kind: "asset" },
      { path: "/sitemap.xml", handler: routes.sitemap, kind: "asset" },
      { path: "/robots.txt", handler: routes.robots, kind: "asset" },
      {
        path: "/images/og-default.svg",
        handler: routes.ogImageDefault,
        kind: "asset",
      },
    ];

    if (atprotoEnabled) {
      routeEntries.push({
        path: "/.well-known/site.standard.publication",
        handler: routes.atprotoVerification,
        kind: "asset",
      });
    }

    // Per-post routes
    for (const post of posts) {
      routeEntries.push({
        path: `/posts/${post.slug as string}`,
        handler: routes.post,
        kind: "page",
      });
      routeEntries.push({
        path: `/images/og/${post.slug as string}.svg`,
        handler: routes.ogImagePost,
        kind: "asset",
      });
    }

    // Per-tag routes
    for (const tag of tags) {
      routeEntries.push({
        path: `/tags/${encodeURIComponent(tag.name as string)}`,
        handler: routes.tagPosts,
        kind: "page",
      });
    }

    // 5. Render all routes
    for (const entry of routeEntries) {
      try {
        // Full page render
        const page = await renderRoute(
          entry.handler,
          entry.path,
          baseUrl,
          false,
        );

        if (!isSuccess(page.status)) {
          errors.push(`${entry.path}: HTTP ${page.status}`);
        } else {
          const outFile = outputPath(outputDir, entry.path, entry.kind);
          const fullContent = entry.kind === "page"
            ? rewriteHtmxUrls(page.body)
            : page.body;
          const writeResult = await fileWriter.writeFile(outFile, fullContent);

          if (writeResult.ok) {
            pages++;
            logger.debug(`Generated: ${outFile}`);
          } else {
            errors.push(`${entry.path}: ${writeResult.error.message}`);
          }
        }

        // Fragment render for page routes
        if (entry.kind === "page") {
          const frag = await renderRoute(
            entry.handler,
            entry.path,
            baseUrl,
            true,
          );
          if (!isSuccess(frag.status)) {
            errors.push(`${entry.path} (fragment): HTTP ${frag.status}`);
          } else {
            const fragFile = fragmentPath(outputDir, entry.path);
            const fragResult = await fileWriter.writeFile(fragFile, frag.body);

            if (fragResult.ok) {
              fragments++;
            } else {
              errors.push(
                `${entry.path} (fragment): ${fragResult.error.message}`,
              );
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${entry.path}: ${msg}`);
        logger.error(`Failed to render ${entry.path}`, e);
      }
    }

    // 6. Fingerprint static assets and rewrite HTML references
    logger.info("Fingerprinting static assets...");
    const fingerprintResult = await fingerprintAssets(
      outputDir,
      fileWriter,
      logger,
    );
    if (!fingerprintResult.ok) {
      errors.push(`Asset fingerprinting: ${fingerprintResult.error.message}`);
    }

    logger.info(
      `Build complete: ${pages} pages, ${fragments} fragments, ${errors.length} errors`,
    );

    return ok({ pages, fragments, assets, errors });
  };

  return { build };
};

// Asset fingerprinting: hash file contents, rename with hash, update HTML refs
const FINGERPRINT_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".woff2",
  ".woff",
  ".ttf",
]);

const hashBytes = async (data: Uint8Array): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(data),
  );
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// "/css/main.css" + "abc" -> "/css/main.abc.css"
export const fingerprintedPath = (
  relativePath: string,
  hash: string,
): string => {
  const dotIndex = relativePath.lastIndexOf(".");
  return `${relativePath.substring(0, dotIndex)}.${hash}${
    relativePath.substring(dotIndex)
  }`;
};

const fingerprintAssets = async (
  outputDir: string,
  fileWriter: FileWriter,
  logger: Logger,
): Promise<AppResult<void>> => {
  const fail = (error: AppError): AppResult<void> =>
    err(
      createError(
        "IOError",
        `Asset fingerprinting failed: ${error.message}`,
        error,
      ),
    );

  // Collect the full file list before any rename
  const listed = await fileWriter.listFiles(outputDir);
  if (!listed.ok) return fail(listed.error);

  const manifest: Record<string, string> = {};

  for (const filePath of listed.value) {
    const ext = filePath.substring(filePath.lastIndexOf("."));
    if (!FINGERPRINT_EXTENSIONS.has(ext)) continue;

    const bytes = await fileWriter.readBytes(filePath);
    if (!bytes.ok) return fail(bytes.error);

    const relativePath = filePath.substring(outputDir.length);
    const hash = await hashBytes(bytes.value);
    const fingerprinted = fingerprintedPath(relativePath, hash);

    const renamed = await fileWriter.rename(
      filePath,
      `${outputDir}${fingerprinted}`,
    );
    if (!renamed.ok) return fail(renamed.error);

    manifest[relativePath] = fingerprinted;
    logger.debug(`Fingerprinted: ${relativePath} -> ${fingerprinted}`);
  }

  if (Object.keys(manifest).length === 0) {
    return ok(undefined);
  }

  // Rewrite HTML files to reference fingerprinted assets
  for (const filePath of listed.value) {
    if (!filePath.endsWith(".html")) continue;

    const read = await fileWriter.readText(filePath);
    if (!read.ok) return fail(read.error);

    let html = read.value;
    let changed = false;

    for (const [original, fingerprinted] of Object.entries(manifest)) {
      if (html.includes(original)) {
        html = html.replaceAll(original, fingerprinted);
        changed = true;
      }
    }

    if (changed) {
      const written = await fileWriter.writeFile(filePath, html);
      if (!written.ok) return fail(written.error);
    }
  }

  // Write manifest for debugging/cache-busting verification
  const manifestResult = await fileWriter.writeFile(
    `${outputDir}/asset-manifest.json`,
    JSON.stringify(manifest, null, 2),
  );
  if (!manifestResult.ok) return fail(manifestResult.error);

  logger.info(
    `Fingerprinted ${Object.keys(manifest).length} assets`,
  );

  return ok(undefined);
};
