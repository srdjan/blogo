import { startServer } from "../http/server.ts";
import { createRouter } from "../http/router.ts";
import { createAccessLog, staticFiles } from "../http/middleware.ts";
import { createRouteHandlers } from "../http/routes.tsx";
import { createContentService } from "../domain/content.ts";
import { createConfig } from "../domain/config.ts";
import { createHealthService } from "../domain/health.ts";
import { createAnalyticsService } from "../domain/analytics.ts";
import { createFileSystem } from "../ports/file-system.ts";
import { createLogger } from "../ports/logger.ts";
import { createInMemoryCache } from "../ports/cache.ts";
import { createClock } from "../ports/clock.ts";
import type { Post, PostMeta } from "../lib/types.ts";

async function main() {
  const config = createConfig();
  const clock = createClock();
  const startTime = clock.timestamp();

  const logger = createLogger({
    enableLogs: config.debug.enableLogs,
    verboseLogs: config.debug.verboseLogs,
    minLevel: config.env === "production" ? "error" : "debug",
  });

  const fileSystem = createFileSystem();
  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();
  const healthCache = createInMemoryCache<unknown>();

  const analyticsResult = await createAnalyticsService();
  if (!analyticsResult.ok) {
    logger.error("Failed to initialize analytics", analyticsResult.error);
    Deno.exit(1);
  }
  const analyticsService = analyticsResult.value;

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir: config.blog.postsDir,
    enableValidation: config.env !== "production",
    analyticsService,
  });

  const healthService = createHealthService({
    fileSystem,
    cache: healthCache,
    postsDir: config.blog.postsDir,
    startTime,
    clock,
  });

  const routes = createRouteHandlers(
    contentService,
    healthService,
    analyticsService,
  );

  const router = createRouter()
    .get("/", routes.home)
    .get("/about", routes.about)
    .get("/tags", routes.tags)
    .get("/tags/:tag", routes.tagPosts)
    .get("/posts/:slug", routes.post)
    .get("/search", routes.search)
    .get("/search-modal", routes.searchModal)
    // RSS page and feeds
    .get("/rss", routes.rssPage)
    .get("/rss/topic/:topicSlug", routes.rssByTopic)
    // Full feed (back-compat: serve both /feed.xml and /rss.xml)
    .get("/feed.xml", routes.rss)
    .get("/rss.xml", routes.rss)
    .get("/sitemap.xml", routes.sitemap)
    .get("/robots.txt", routes.robots)
    .get("/images/og-default.svg", routes.ogImageDefault)
    .get(/^\/images\/og\/(.+)\.svg$/, routes.ogImagePost)
    .get("/health", routes.health);

  // Graceful shutdown setup
  const abortController = new AbortController();

  const server = startServer(router.handler(), {
    port: config.server.port,
    hostname: config.server.host,
    signal: abortController.signal,
    middlewares: [
      createAccessLog(healthService),
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
    analyticsService.close();
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
