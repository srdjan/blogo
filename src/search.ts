// src/search.ts - Search functionality with improved accuracy and performance
import { Post } from "./types.ts";

// Pre-defined weights for scoring results
const WEIGHTS = {
  TITLE: 3.0,    // Highest weight for title matches
  TAG: 2.0,      // High weight for tag matches
  EXCERPT: 1.0,  // Medium weight for excerpt matches
  CONTENT: 0.5   // Lower weight for content matches
};

/**
 * Cache search results to avoid recomputing expensive operations
 * Format: { "query": { timestamp: number, results: Post[] } }
 */
const searchCache = new Map<string, { timestamp: number; results: Post[] }>();
const SEARCH_CACHE_TTL = 60 * 1000; // 1 minute cache lifetime

/**
 * Prepare a post for efficient searching by pre-computing normalized searchable text
 */
interface SearchablePost {
  post: Post;
  title: string;    // Normalized title
  excerpt: string;  // Normalized excerpt
  content: string;  // Normalized content with HTML stripped
  tags: string;     // Normalized tags joined as a string
}

/**
 * Prepare post for efficient searching by pre-computing fields
 */
const prepareSearchablePost = (post: Post): SearchablePost => {
  return {
    post,
    title: post.title.toLowerCase(),
    excerpt: (post.excerpt || "").toLowerCase(),
    content: post.content.replace(/<[^>]*>/g, " ").toLowerCase(),
    tags: (post.tags || []).join(" ").toLowerCase()
  };
};

/**
 * Search posts by a query string with caching and optimized scoring
 */
export const searchPosts = (
  posts: Post[],
  query: string
): Post[] => {
  // Validate and normalize search input
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  
  // Check cache first
  const now = Date.now();
  const cachedResult = searchCache.get(normalizedQuery);
  
  if (cachedResult && (now - cachedResult.timestamp < SEARCH_CACHE_TTL)) {
    return cachedResult.results;
  }
  
  // Parse search terms
  const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);
  if (terms.length === 0) return [];
  
  // Prepare posts for searching (only do this work once)
  const searchablePosts = posts.map(prepareSearchablePost);
  
  // Score and rank posts
  const results = rankSearchResults(searchablePosts, terms);
  
  // Cache results for future queries
  searchCache.set(normalizedQuery, { timestamp: now, results });
  
  return results;
};

/**
 * Score and rank posts based on search terms
 */
const rankSearchResults = (
  searchablePosts: SearchablePost[],
  terms: string[]
): Post[] => {
  const scoredPosts = searchablePosts.map(searchablePost => {
    const { post, title, excerpt, content, tags } = searchablePost;
    
    // Calculate score across all terms
    let totalScore = 0;
    let hasAnyMatch = false;
    
    for (const term of terms) {
      // Check each field for matches
      const inTitle = title.includes(term);
      const inTags = tags.includes(term);
      const inExcerpt = excerpt.includes(term);
      const inContent = content.includes(term);
      
      // Determine if this term matched anywhere
      const matched = inTitle || inTags || inExcerpt || inContent;
      
      if (matched) {
        hasAnyMatch = true;
        
        // Add weighted scores for each match location
        if (inTitle) totalScore += WEIGHTS.TITLE;
        if (inTags) totalScore += WEIGHTS.TAG;
        if (inExcerpt) totalScore += WEIGHTS.EXCERPT;
        if (inContent) totalScore += WEIGHTS.CONTENT;
      }
    }
    
    return { post, score: totalScore, hasMatch: hasAnyMatch };
  });
  
  // Only return relevant posts sorted by score
  return scoredPosts
    .filter(result => result.hasMatch)
    .sort((a, b) => b.score - a.score)
    .map(result => result.post);
};