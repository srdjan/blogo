// Content loading utilities for mono-jsx
import { Post, TagInfo } from "../types.ts";
import { loadPosts } from "../parser.ts";
import { logger } from "../utils.ts";

// Cache for posts with TTL
interface Cache<T> {
  get: () => T | null;
  set: (value: T) => void;
  invalidate: () => void;
}

const createCache = <T>(ttl: number): Cache<T> => {
  let data: T | null = null;
  let timestamp = 0;

  return {
    get: () => {
      const now = Date.now();
      if (data && (now - timestamp) < ttl) {
        return data;
      }
      return null;
    },
    set: (value: T) => {
      data = value;
      timestamp = Date.now();
    },
    invalidate: () => {
      data = null;
      timestamp = 0;
    },
  };
};

// Cache instances
const postsCache = createCache<Post[]>(5 * 60 * 1000); // 5 minutes
const tagsCache = createCache<TagInfo[]>(5 * 60 * 1000); // 5 minutes

// Load posts with caching
export async function getCachedPosts(): Promise<Post[]> {
  // Try cache first
  const cached = postsCache.get();
  if (cached) {
    return cached;
  }

  // Load from disk
  logger.info("Loading posts from disk...");
  const result = await loadPosts();

  if (!result.ok) {
    logger.error("Failed to load posts:", result.error);
    return [];
  }

  // Sort by date (newest first)
  const sortedPosts = result.value.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Cache the result
  postsCache.set(sortedPosts);
  logger.info(`Loaded ${sortedPosts.length} posts`);

  return sortedPosts;
}

// Generate tag information from posts
export function generateTagsFromPosts(posts: Post[]): TagInfo[] {
  const tagMap = new Map<string, TagInfo>();

  posts.forEach((post) => {
    if (post.tags) {
      post.tags.forEach((tagName) => {
        if (tagMap.has(tagName)) {
          const existing = tagMap.get(tagName)!;
          existing.count++;
          existing.posts.push(post);
        } else {
          tagMap.set(tagName, {
            name: tagName,
            count: 1,
            posts: [post],
          });
        }
      });
    }
  });

  // Convert to array and sort by count (descending)
  return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
}

// Get cached tags
export async function getCachedTags(): Promise<TagInfo[]> {
  // Try cache first
  const cached = tagsCache.get();
  if (cached) {
    return cached;
  }

  // Generate from posts
  const posts = await getCachedPosts();
  const tags = generateTagsFromPosts(posts);

  // Cache the result
  tagsCache.set(tags);

  return tags;
}

// Find a specific post by slug
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const posts = await getCachedPosts();
  return posts.find((post) => post.slug === slug) || null;
}

// Get posts by tag
export async function getPostsByTag(tagName: string): Promise<Post[]> {
  const posts = await getCachedPosts();
  return posts.filter((post) => post.tags && post.tags.includes(tagName));
}

// Search posts by query
export async function searchPostsByQuery(query: string): Promise<Post[]> {
  const posts = await getCachedPosts();
  const lowerQuery = query.toLowerCase();

  return posts.filter((post) =>
    post.title.toLowerCase().includes(lowerQuery) ||
    post.content.toLowerCase().includes(lowerQuery) ||
    (post.excerpt && post.excerpt.toLowerCase().includes(lowerQuery)) ||
    (post.tags &&
      post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
  );
}
