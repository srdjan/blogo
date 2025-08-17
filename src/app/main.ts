import { startServer } from "../http/server.ts";
import { createRouter } from "../http/router.ts";
import { accessLog, staticFiles } from "../http/middleware.ts";
import { createRouteHandlers } from "../http/routes.tsx";
import { createContentService } from "../domain/content.ts";
import { createConfig } from "../domain/config.ts";
import { createFileSystem } from "../ports/file-system.ts";
import { createLogger } from "../ports/logger.ts";
import { createInMemoryCache } from "../ports/cache.ts";
import type { Post } from "../lib/types.ts";

function main() {
  const config = createConfig();
  
  const logger = createLogger({
    enableLogs: config.debug.enableLogs,
    verboseLogs: config.debug.verboseLogs,
    minLevel: config.env === "production" ? "error" : "debug",
  });

  const fileSystem = createFileSystem();
  const cache = createInMemoryCache<readonly Post[]>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    postsDir: config.blog.postsDir,
  });

  const routes = createRouteHandlers(contentService);
  
  const router = createRouter()
    .get("/", routes.home)
    .get("/about", routes.about)
    .get("/tags", routes.tags)
    .get("/tags/:tag", routes.tagPosts)
    .get("/posts/:slug", routes.post)
    .get("/search", routes.search)
    .get("/search-modal", routes.searchModal)
    .get("/feed.xml", routes.rss)
    .get("/sitemap.xml", routes.sitemap)
    .get("/robots.txt", routes.robots)
    .get("/images/og-default.png", routes.ogImageDefault)
    .get(/^\/images\/og\/(.+)\.png$/, routes.ogImagePost);

  // Graceful shutdown setup
  const abortController = new AbortController();

  const server = startServer(router.handler(), {
    port: config.server.port,
    hostname: config.server.host,
    signal: abortController.signal,
    middlewares: [
      accessLog,
      staticFiles("public"),
    ],
    beforeStart: () => {
      logger.info(`Starting blog server in ${config.env} mode`);
      logger.info(`Posts directory: ${config.blog.postsDir}`);
    },
    onError: (error, req) => {
      logger.error(`Unhandled error for ${req.method} ${req.url}`, error);
      return new Response("Internal Server Error", { status: 500 });
    },
  });
  
  const shutdown = () => {
    logger.info("Shutting down server...");
    abortController.abort();
    Deno.exit(0);
  };

  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  return server;
}

if (import.meta.main) {
  main();
}