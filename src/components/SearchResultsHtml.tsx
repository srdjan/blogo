import { Post } from "../types.ts";
import {
  createPostLink,
  pluralize,
  renderPostExcerpt,
  renderPostMeta,
} from "../utils/html-helpers.ts";

export const renderSearchResultsHtml = (
  posts: Post[],
  query: string,
): string => {
  if (!query || query.trim().length === 0) {
    return "";
  }

  if (posts.length === 0) {
    return `<section class="search-results-summary">
      No posts found matching "${query}"
    </section>`;
  }

  const resultsHtml = posts.map((post) => {
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

  return `<section>
    <div class="search-results-summary">
      Found ${posts.length} ${
    pluralize(posts.length, "post")
  } matching "${query}"
    </div>
    ${resultsHtml}
  </section>`;
};
