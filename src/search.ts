// src/search.ts - Search functionality with improved accuracy
import { Post } from "./types.ts";

/**
 * Search posts by a query string
 * Uses a precise case-insensitive search across multiple fields
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

  // Improved scoring system based on exact matches
  const scoredPosts = posts.map(post => {
    const titleLower = post.title.toLowerCase();
    const excerptLower = (post.excerpt || "").toLowerCase();
    // Strip HTML tags for content search
    const contentText = post.content.replace(/<[^>]*>/g, " ");
    const contentLower = contentText.toLowerCase();
    const tagsLower = (post.tags || []).join(" ").toLowerCase();

    // Count matches per term
    let score = 0;
    let hasAnyMatch = false;

    for (const term of terms) {
      // Verify that the term actually exists in the post
      const termInTitle = titleLower.includes(term);
      const termInTags = tagsLower.includes(term);
      const termInExcerpt = excerptLower.includes(term);
      const termInContent = contentLower.includes(term);

      // Only count as a match if the term is actually found
      const hasMatch = termInTitle || termInTags || termInExcerpt || termInContent;

      if (hasMatch) {
        hasAnyMatch = true;

        // Title matches get higher weight
        if (termInTitle) {
          score += 3;
        }

        // Tag matches get medium weight
        if (termInTags) {
          score += 2;
        }

        // Excerpt matches
        if (termInExcerpt) {
          score += 1;
        }

        // Content matches
        if (termInContent) {
          score += 0.5;
        }
      }
    }

    // Only return posts that actually contain at least one of the search terms
    return {
      post,
      score,
      hasMatch: hasAnyMatch
    };
  });

  // Filter out posts with no matches and sort by score
  return scoredPosts
    .filter(({ hasMatch }) => hasMatch)
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
};