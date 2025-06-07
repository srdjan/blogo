import { Post } from "../types.ts";
import { 
  renderPostMeta, 
  renderPostExcerpt, 
  createPostLink,
  pluralize 
} from "../utils/html-helpers.ts";

export const renderSearchResultsHtml = (posts: Post[], query: string): string => {
  if (!query || query.trim().length === 0) {
    return "";
  }
  
  if (posts.length === 0) {
    return `<div class="search-results-summary content-section">
      No posts found matching "${query}"
    </div>`;
  }
  
  const resultsHtml = posts.map(post => {
    const postMeta = renderPostMeta(post);
    const excerpt = renderPostExcerpt(post);
    
    return `<article class="search-result">
      <h3>
        ${createPostLink(post.slug, post.title)}
      </h3>
      ${postMeta}
      ${excerpt}
    </article>`;
  }).join("");
  
  return `<div class="search-results-container">
    <div class="search-results-summary content-section">
      Found ${posts.length} ${pluralize(posts.length, "post")} matching "${query}"
    </div>
    ${resultsHtml}
  </div>`;
};
