import type { AppResult, Slug, TagName } from "../lib/types.ts";
import { createSlug } from "../lib/types.ts";
import { err, ok } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import type { FileSystem } from "../ports/file-system.ts";
import type { FileWriter } from "../ports/writer.ts";
import type { AtProtoClient } from "../ports/atproto.ts";
import type { Logger } from "../ports/logger.ts";
import type { AtProtoConfig } from "../config/atproto.ts";
import type {
  Publication,
  PutRecordResponse,
  StandardDocument,
} from "../atproto/types.ts";
import {
  documentToMarkdown,
  postToDocument,
  slugToRkey,
} from "../atproto/mapping.ts";
import { extractFrontmatter } from "./content.ts";
import { markdownToHtml } from "../markdown-renderer.tsx";

export type PublishReport = {
  readonly published: number;
  readonly skipped: number;
  readonly errors: readonly string[];
};

export type PullReport = {
  readonly pulled: number;
  readonly skipped: number;
  readonly errors: readonly string[];
};

export interface AtProtoService {
  readonly ensurePublication: () => Promise<AppResult<PutRecordResponse>>;
  readonly publishAll: () => Promise<AppResult<PublishReport>>;
  readonly publishPost: (slug: Slug) => Promise<AppResult<PutRecordResponse>>;
  readonly pullAll: (
    options?: { readonly force?: boolean },
  ) => Promise<AppResult<PullReport>>;
}

export type AtProtoDependencies = {
  readonly client: AtProtoClient;
  readonly fileSystem: FileSystem;
  readonly fileWriter: FileWriter;
  readonly logger: Logger;
  readonly config: AtProtoConfig;
  readonly postsDir: string;
  readonly publicUrl: string;
  readonly blogName: string;
  readonly blogDescription: string;
};

export const createAtProtoService = (
  deps: AtProtoDependencies,
): AtProtoService => {
  const {
    client,
    fileSystem,
    fileWriter,
    logger,
    config,
    postsDir,
    publicUrl,
    blogName,
    blogDescription,
  } = deps;

  const publicationUri = `at://${config.did}/site.standard.publication/self`;

  const ensurePublication = async (): Promise<
    AppResult<PutRecordResponse>
  > => {
    const record: Publication = {
      $type: "site.standard.publication",
      url: publicUrl,
      name: blogName,
      description: blogDescription,
    };

    logger.info("Ensuring publication record exists");
    return client.putRecord({
      collection: "site.standard.publication",
      rkey: "self",
      record: record as unknown as Record<string, unknown>,
    });
  };

  const publishPost = async (
    slug: Slug,
  ): Promise<AppResult<PutRecordResponse>> => {
    const filePath = `${postsDir}/${slug as string}.md`;
    const fileResult = await fileSystem.readFile(filePath);
    if (!fileResult.ok) return fileResult;

    const fmResult = extractFrontmatter(fileResult.value);
    if (!fmResult.ok) return fmResult;

    const { frontmatter, markdown } = fmResult.value;

    // Parse frontmatter to get post metadata
    const { parse: parseYaml } = await import("@std/yaml");
    const meta = parseYaml(frontmatter) as Record<string, unknown>;

    const htmlResult = markdownToHtml(markdown);
    if (!htmlResult.ok) return htmlResult;

    const post: import("../lib/types.ts").Post = {
      title: String(meta.title ?? ""),
      date: String(meta.date ?? ""),
      slug,
      content: htmlResult.value,
      ...(meta.excerpt ? { excerpt: String(meta.excerpt) } : {}),
      ...(Array.isArray(meta.tags)
        ? { tags: meta.tags.map((t: unknown) => String(t) as TagName) }
        : {}),
      ...(meta.modified ? { modified: String(meta.modified) } : {}),
    };

    const doc = postToDocument({
      post,
      rawMarkdown: markdown,
      publicationUri,
      publicUrl,
    });

    const rkey = slugToRkey(slug);
    logger.info(`Publishing: ${slug} -> ${rkey}`);

    return client.putRecord({
      collection: "site.standard.document",
      rkey,
      record: doc as unknown as Record<string, unknown>,
    });
  };

  const publishAll = async (): Promise<AppResult<PublishReport>> => {
    const entriesResult = await fileSystem.readDir(postsDir);
    if (!entriesResult.ok) return entriesResult;

    const markdownFiles = entriesResult.value.filter((name) =>
      name.endsWith(".md")
    );

    let published = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const filename of markdownFiles) {
      const slug = createSlug(filename.replace(/\.md$/, ""));
      const result = await publishPost(slug);

      if (result.ok) {
        published++;
      } else {
        errors.push(`${slug}: ${result.error.message}`);
        logger.error(`Failed to publish ${slug}`, result.error);
      }
    }

    logger.info(
      `Publish complete: ${published} published, ${skipped} skipped, ${errors.length} errors`,
    );
    return ok({ published, skipped, errors });
  };

  const pullAll = async (
    options?: { readonly force?: boolean },
  ): Promise<AppResult<PullReport>> => {
    const force = options?.force ?? false;
    let pulled = 0;
    let skipped = 0;
    const errors: string[] = [];
    let cursor: string | undefined;

    do {
      const listParams: {
        readonly collection: string;
        readonly limit: number;
        readonly cursor?: string;
      } = cursor
        ? { collection: "site.standard.document", limit: 100, cursor }
        : { collection: "site.standard.document", limit: 100 };

      const result = await client.listRecords<StandardDocument>(listParams);

      if (!result.ok) {
        return err(
          createError(
            "NetworkError",
            "Failed to list records from PDS",
            result.error,
          ),
        );
      }

      for (const record of result.value.records) {
        const { filename, content } = documentToMarkdown(record.value);
        const filePath = `${postsDir}/${filename}`;

        // Skip if file exists and not forcing
        if (!force) {
          const exists = await fileSystem.exists(filePath);
          if (exists) {
            skipped++;
            logger.debug(`Skipping existing file: ${filename}`);
            continue;
          }
        }

        const writeResult = await fileWriter.writeFile(filePath, content);
        if (writeResult.ok) {
          pulled++;
          logger.info(`Pulled: ${filename}`);
        } else {
          errors.push(`${filename}: ${writeResult.error.message}`);
          logger.error(`Failed to write ${filename}`, writeResult.error);
        }
      }

      cursor = result.value.cursor;
    } while (cursor);

    logger.info(
      `Pull complete: ${pulled} pulled, ${skipped} skipped, ${errors.length} errors`,
    );
    return ok({ pulled, skipped, errors });
  };

  return {
    ensurePublication,
    publishAll,
    publishPost,
    pullAll,
  };
};
