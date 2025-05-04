/**
 * Component for rendering search results
 */

import { Post } from "../types.ts";
import { formatDate } from "../utils.ts";
import { Tags } from "./Post.tsx";

// Helper function to get formatted date from a post
const getFormattedDate = (post: Post): string => {
  return post.formattedDate || formatDate(post.date);
};

// Component for rendering a single search result
export const SearchResult = ({ post }: { post: Post }) => {
  const formattedDate = getFormattedDate(post);

  return (
    <article class="search-result">
      <h3>
        <a
          href={`/posts/${post.slug}`}
          class="link"
          hx-get={`/posts/${post.slug}`}
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          {post.title}
        </a>
      </h3>
      <div class="post-meta">
        <time dateTime={post.date}>{formattedDate}</time>
        {post.tags && <Tags tags={post.tags} />}
      </div>
      {post.excerpt && <p class="post-excerpt">{post.excerpt}</p>}
    </article>
  );
};

// Component for rendering search results
export const SearchResults = ({ posts, query }: { posts: Post[]; query: string }) => {
  if (!query || query.trim().length === 0) {
    return <div></div>; // Return empty div instead of null
  }

  if (posts.length === 0) {
    return (
      <div class="search-results-summary content-section">
        No posts found matching "{query}"
      </div>
    );
  }

  return (
    <div class="search-results-container">
      <div class="search-results-summary content-section">
        Found {posts.length} post{posts.length !== 1 ? "s" : ""} matching "{query}"
      </div>
      {posts.map(post => <SearchResult key={post.slug} post={post} />)}
    </div>
  );
};
