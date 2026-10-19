import {
  aggregateTags,
  type ContentService,
} from "../../src/domain/content.ts";
import { err, ok } from "../../src/lib/result.ts";
import { createError } from "../../src/lib/error.ts";
import type { Post, PostMeta } from "../../src/lib/types.ts";

/**
 * In-memory ContentService over a fixed post list. `overrides` replaces single
 * methods, for example to return an error result.
 */
export const createMemoryContentService = (
  posts: readonly Post[],
  overrides: Partial<ContentService> = {},
): ContentService => ({
  loadPosts: () => Promise.resolve(ok(posts)),
  loadPostsMetadata: () => Promise.resolve(ok(posts as readonly PostMeta[])),
  loadPostsMetadataWithViews: () => Promise.resolve(ok(posts)),
  loadPostsWithViews: () => Promise.resolve(ok(posts)),
  getPostBySlug: (slug) => {
    const post = posts.find((candidate) => candidate.slug === slug);
    return Promise.resolve(
      post ? ok(post) : err(createError("NotFound", `Post not found: ${slug}`)),
    );
  },
  getPostsByTag: (tag) =>
    Promise.resolve(
      ok(posts.filter((post) => post.tags?.includes(tag) ?? false)),
    ),
  getTags: () => Promise.resolve(ok(aggregateTags(posts))),
  searchPosts: (query) =>
    Promise.resolve(
      ok(
        posts.filter((post) =>
          post.title.toLowerCase().includes(query.toLowerCase())
        ),
      ),
    ),
  ...overrides,
});
