import { createAtProtoConfig } from "../config/atproto.ts";
import { createAtProtoClient } from "../ports/atproto.ts";
import { createFileSystem } from "../ports/file-system.ts";
import { createFileWriter } from "../ports/writer.ts";
import { createLogger } from "../ports/logger.ts";
import { createAtProtoService } from "../domain/atproto.ts";
import { match } from "../lib/result.ts";

async function main() {
  const logger = createLogger({
    enableLogs: true,
    verboseLogs: true,
    minLevel: "info",
  });

  const atConfig = createAtProtoConfig();
  if (!atConfig) {
    console.error(
      "AT Protocol not configured. Set ATPROTO_DID, ATPROTO_HANDLE, and ATPROTO_APP_PASSWORD.",
    );
    Deno.exit(1);
  }

  const clientResult = await createAtProtoClient(atConfig);
  if (!clientResult.ok) {
    console.error("Failed to authenticate:", clientResult.error.message);
    Deno.exit(1);
  }

  const publicUrl = Deno.env.get("PUBLIC_URL") ||
    "https://blogo.timok.deno.net";
  const postsDir = Deno.env.get("POSTS_DIR") || "content/posts";

  const service = createAtProtoService({
    client: clientResult.value,
    fileSystem: createFileSystem(),
    fileWriter: createFileWriter(),
    logger,
    config: atConfig,
    postsDir,
    publicUrl,
    blogName: Deno.env.get("BLOG_TITLE") || "Blogo",
    blogDescription: Deno.env.get("BLOG_DESCRIPTION") ||
      "A minimal blog vibe coded with Claude",
  });

  // Ensure publication record exists
  const pubResult = await service.ensurePublication();
  match(pubResult, {
    ok: () => logger.info("Publication record confirmed"),
    error: (e) => {
      console.error("Failed to ensure publication:", e.message);
      Deno.exit(1);
    },
  });

  // Publish all posts
  const report = await service.publishAll();
  match(report, {
    ok: (r) => {
      console.log(
        `Published: ${r.published}, Skipped: ${r.skipped}, Errors: ${r.errors.length}`,
      );
      if (r.errors.length > 0) {
        for (const e of r.errors) console.error(`  - ${e}`);
      }
    },
    error: (e) => {
      console.error("Publish failed:", e.message);
      Deno.exit(1);
    },
  });
}

if (import.meta.main) {
  main();
}
