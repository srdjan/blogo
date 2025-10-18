import { createContentService } from "./src/domain/content.ts";
import { createFileSystem } from "./src/ports/file-system.ts";
import { createLogger } from "./src/ports/logger.ts";
import { createInMemoryCache } from "./src/ports/cache.ts";
import type { Post } from "./src/lib/types.ts";

const logger = createLogger({ enableLogs: true, verboseLogs: false, minLevel: "debug" });
const fileSystem = createFileSystem();
const cache = createInMemoryCache<readonly Post[]>();

const contentService = createContentService({ fileSystem, logger, cache, postsDir: "content/posts" });

const tagsRes = await contentService.getTags();
if (!tagsRes.ok) {
  console.error("getTags error", tagsRes.error);
  Deno.exit(1);
}

const tags = tagsRes.value;
const lower = (s: string) => s.trim().toLowerCase();

console.log("Total tags:", tags.length);
for (const t of tags) {
  if (lower(String(t.name)) === "typescript" || String(t.name).toLowerCase().includes("type")) {
    console.log("TAG:", t.name, "count:", t.count);
  }
}

console.log("\nAll tags sample:");
console.log(tags.map(t => String(t.name)).sort().join(", "));
