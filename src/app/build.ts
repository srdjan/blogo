import { createRouteHandlers } from "../http/routes.tsx";
import { createContentService } from "../domain/content.ts";
import { createHealthService } from "../domain/health.ts";
import { createFileSystem } from "../ports/file-system.ts";
import { createFileWriter } from "../ports/writer.ts";
import { createLogger } from "../ports/logger.ts";
import { createInMemoryCache } from "../ports/cache.ts";
import { createClock } from "../ports/clock.ts";
import { createStaticBuilder } from "../domain/static-builder.ts";
import { createAtProtoConfig } from "../config/atproto.ts";
import { match, ok } from "../lib/result.ts";
import type { Post, PostMeta } from "../lib/types.ts";
import type { AnalyticsService } from "../domain/analytics.ts";

async function main() {
  const logger = createLogger({
    enableLogs: true,
    verboseLogs: true,
    minLevel: "info",
  });

  const fileSystem = createFileSystem();
  const fileWriter = createFileWriter();
  const clock = createClock();
  const startTime = clock.timestamp();

  const postsDir = Deno.env.get("POSTS_DIR") || "content/posts";
  const publicUrl = Deno.env.get("PUBLIC_URL") ||
    "https://blogo.timok.deno.net";
  const outputDir = Deno.args[0] || "_site";

  const cache = createInMemoryCache<readonly Post[]>();
  const metadataCache = createInMemoryCache<readonly PostMeta[]>();
  const postCache = createInMemoryCache<Post>();
  const healthCache = createInMemoryCache<unknown>();

  const contentService = createContentService({
    fileSystem,
    logger,
    cache,
    metadataCache,
    postCache,
    postsDir,
    enableValidation: false,
  });

  // Minimal analytics stub for route handlers (no KV needed for static build)
  const analyticsStub: AnalyticsService = {
    incrementViewCount: async () => ok(0),
    getViewCount: async () => ok(0),
    getAllViewCounts: async () => ok({} as Record<string, number>),
    close: () => {},
  };

  const healthService = createHealthService({
    fileSystem,
    cache: healthCache,
    postsDir,
    startTime,
    clock,
  });

  const atConfig = createAtProtoConfig();

  const routes = createRouteHandlers(
    contentService,
    healthService,
    analyticsStub,
    atConfig,
  );

  const builder = createStaticBuilder({
    contentService,
    routes,
    fileWriter,
    logger,
    publicDir: "public",
  });

  logger.info(`Building static site to ${outputDir}/`);

  const result = await builder.build({
    outputDir,
    baseUrl: publicUrl,
  });

  match(result, {
    ok: (report) => {
      console.log(
        `Build complete: ${report.pages} pages, ${report.fragments} fragments`,
      );
      if (report.errors.length > 0) {
        console.error(`Errors (${report.errors.length}):`);
        for (const e of report.errors) console.error(`  - ${e}`);
        Deno.exit(1);
      }
    },
    error: (e) => {
      console.error("Build failed:", e.message);
      Deno.exit(1);
    },
  });
}

if (import.meta.main) {
  main();
}
