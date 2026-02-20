import { startServer } from "../http/server.ts";
import { createRouter } from "../http/router.ts";
import {
  compress,
  createRequestTracking,
  staticFiles,
} from "../http/middleware.ts";
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
import { createAtProtoConfig } from "../config/atproto.ts";

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

  const atConfig = createAtProtoConfig();
  if (atConfig) {
    logger.info(`AT Protocol configured for ${atConfig.did}`);
  }

  const routes = createRouteHandlers(
    contentService,
    healthService,
    analyticsService,
    atConfig,
  );

  // Pre-warm all caches at startup (production only)
  if (config.env === "production") {
    const warmStart = performance.now();
    Promise.all([
      contentService.loadPosts(),
      contentService.loadPostsMetadataWithViews(),
    ]).then(([postsResult, _metaResult]) => {
      // Populate individual post cache entries
      if (postsResult.ok) {
        for (const post of postsResult.value) {
          postCache.set(post.slug as string, post, Infinity);
        }
      }
      const elapsed = (performance.now() - warmStart).toFixed(0);
      logger.info(`Cache pre-warming completed in ${elapsed}ms`);
    }).catch((error) => {
      logger.warn("Failed to prewarm caches", error);
    });
  }

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
    .get("/health", routes.health)
    .get(
      "/.well-known/site.standard.publication",
      routes.atprotoVerification,
    );

  // Graceful shutdown setup
  const abortController = new AbortController();

  const server = startServer(router.handler(), {
    port: config.server.port,
    hostname: config.server.host,
    signal: abortController.signal,
    middlewares: [
      staticFiles("public"),
      createRequestTracking(healthService),
      compress(),
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

  // File watcher for cache invalidation (production only)
  if (config.env === "production") {
    let rewarmInProgress = false;
    const watcher = Deno.watchFs(config.blog.postsDir);
    (async () => {
      for await (const event of watcher) {
        if (!["modify", "create", "remove"].includes(event.kind)) continue;
        if (rewarmInProgress) continue;

        rewarmInProgress = true;
        logger.info(`File change detected (${event.kind}), invalidating caches`);

        // Clear all caches
        cache.clear();
        metadataCache.clear();
        postCache.clear();
        routes.clearHtmlCache();

        // Re-warm
        try {
          const [postsResult] = await Promise.all([
            contentService.loadPosts(),
            contentService.loadPostsMetadataWithViews(),
          ]);
          if (postsResult.ok) {
            for (const post of postsResult.value) {
              postCache.set(post.slug as string, post, Infinity);
            }
          }
          logger.info("Cache re-warming completed after file change");
        } catch (error) {
          logger.warn("Failed to re-warm caches after file change", error);
        } finally {
          rewarmInProgress = false;
        }
      }
    })();
  }

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
