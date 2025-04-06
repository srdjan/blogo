// src/search.ts - Search functionality
import { Post } from "./types.ts";

/**
 * Search posts by a query string
 * Uses a simple case-insensitive search across multiple fields
 */
export const searchPosts = (
  posts: Post[],
  query: string
): Post[] => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

  // No search terms, return empty array
  if (terms.length === 0) {
    return [];
  }

  // Simple scoring system based on matches
  const scoredPosts = posts.map(post => {
    const titleLower = post.title.toLowerCase();
    const excerptLower = (post.excerpt || "").toLowerCase();
    // Strip HTML tags for content search
    const contentLower = post.content
      .replace(/<[^>]*>/g, " ")
      .toLowerCase();
    const tagsLower = (post.tags || []).join(" ").toLowerCase();

    // Count matches per term
    let score = 0;

    for (const term of terms) {
      // Title matches get higher weight
      if (titleLower.includes(term)) {
        score += 3;
      }

      // Tag matches get medium weight
      if (tagsLower.includes(term)) {
        score += 2;
      }

      // Excerpt matches
      if (excerptLower.includes(term)) {
        score += 1;
      }

      // Content matches
      if (contentLower.includes(term)) {
        score += 0.5;
      }
    }

    return { post, score };
  });

  // Filter out posts with no matches and sort by score
  return scoredPosts
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
};