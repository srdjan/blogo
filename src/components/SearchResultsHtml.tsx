import { Post } from "../types.ts";
import { formatDate } from "../utils.ts";

export const renderSearchResultsHtml = (posts: Post[], query: string): string => {
  if (!query || query.trim().length === 0) {
    return "";
  }
  
  if (posts.length === 0) {
    return `<div class="search-results-summary content-section">
      No posts found matching "${query}"
    </div>`;
  }
  
  // Helper function to render tags
  const renderTags = (tags: string[]): string => {
    if (!tags || tags.length === 0) return "";
    
    const tagLinks = tags.map(tag => 
      `<a 
        href="/tags/${tag}" 
        class="tag link" 
        hx-get="/tags/${tag}" 
        hx-target="#content-area" 
        hx-swap="innerHTML" 
        hx-push-url="true"
      >
        ${tag}
      </a>`
    ).join("");
    
    return `<div class="tags">${tagLinks}</div>`;
  };
  
  const resultsHtml = posts.map(post => {
    const tags = post.tags ? renderTags(post.tags) : "";
    const formattedDate = post.formattedDate || formatDate(post.date);
    const excerpt = post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : "";
    
    return `<article class="search-result">
      <h3>
        <a
          href="/posts/${post.slug}"
          class="link"
          hx-get="/posts/${post.slug}"
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          ${post.title}
        </a>
      </h3>
      <div class="post-meta">
        <time datetime="${post.date}">${formattedDate}</time>
        ${tags}
      </div>
      ${excerpt}
    </article>`;
  }).join("");
  
  return `<div class="search-results-container">
    <div class="search-results-summary content-section">
      Found ${posts.length} post${posts.length !== 1 ? "s" : ""} matching "${query}"
    </div>
    ${resultsHtml}
  </div>`;
};
