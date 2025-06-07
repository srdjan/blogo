import { Post } from "../types.ts";
import type { Pagination } from "../pagination.ts";
import {
  createHtmxLink,
  createPostLink,
  pluralize,
  renderPostExcerpt,
  renderPostMeta,
} from "../utils/html-helpers.ts";

export const renderPostListHtml = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination,
): string => {
  // Helper function to render pagination
  const renderPagination = (pagination: Pagination): string => {
    const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

    // Don't render pagination if there's only one page
    if (totalPages <= 1) {
      return "";
    }

    // Generate page numbers to show
    const pageNumbers: Array<number | null> = [];

    // Always show first page
    pageNumbers.push(1);

    // Add ellipsis if needed
    if (currentPage > 3) {
      pageNumbers.push(null); // represents ellipsis
    }

    // Show nearby pages
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pageNumbers.push(i);
    }

    // Add ellipsis if needed
    if (currentPage < totalPages - 2) {
      pageNumbers.push(null); // represents ellipsis
    }

    // Always show last page if it's not the only page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    // Render previous button
    const prevButton = hasPrevPage
      ? createHtmxLink(
        `?page=${currentPage - 1}`,
        "Previous",
        "pagination-prev link",
        `aria-label="Previous page"`,
      )
      : `<span class="pagination-prev pagination-disabled" aria-disabled="true">Previous</span>`;

    // Render page numbers
    const pageLinks = pageNumbers.map((page) => {
      if (page === null) {
        return `<span class="pagination-ellipsis">&hellip;</span>`;
      }

      if (page === currentPage) {
        return `<span class="pagination-current" aria-current="page">${page}</span>`;
      }

      return createHtmxLink(`?page=${page}`, page.toString());
    }).join("");

    // Render next button
    const nextButton = hasNextPage
      ? createHtmxLink(
        `?page=${currentPage + 1}`,
        "Next",
        "pagination-next link",
        `aria-label="Next page"`,
      )
      : `<span class="pagination-next pagination-disabled" aria-disabled="true">Next</span>`;

    return `<nav class="pagination content-section" aria-label="Pagination Navigation">
      ${prevButton}
      <div class="pagination-pages">
        ${pageLinks}
      </div>
      ${nextButton}
      <div class="pagination-info">
        <p>Page ${currentPage} of ${totalPages}</p>
      </div>
    </nav>`;
  };

  // Render tag header
  let tagHeader = "";
  if (activeTag) {
    tagHeader = `
      <div class="tag-header-container">
        <h1>Posts Tagged "${activeTag}"</h1>
        <div class="tag-filter-header">
          <p>
            Showing ${posts.length} ${
      pluralize(posts.length, "post")
    } tagged with <strong>${activeTag}</strong>
          </p>
          ${createHtmxLink("/", "Show All Posts", "button link")}
        </div>
      </div>
    `;
  }

  // Render post cards
  let postCards = "";
  if (posts.length > 0) {
    postCards = posts.map((post) => {
      const postMeta = renderPostMeta(post);
      const excerpt = renderPostExcerpt(post);

      return `<article class="post-card">
        <div class="post-card-inner">
          <h2>
            ${createPostLink(post.slug, post.title)}
          </h2>
          ${postMeta}
          ${excerpt}
        </div>
      </article>`;
    }).join("");
  } else {
    postCards = `<div class="empty-state">
      <p>No posts found${activeTag ? ` tagged with "${activeTag}"` : ""}.</p>
    </div>`;
  }

  // Render pagination
  let paginationHtml = "";
  if (pagination) {
    paginationHtml = renderPagination(pagination);
  }

  // Render the complete post list
  return `<section class="post-list">
    <main>
      ${tagHeader}
      <div class="post-cards-container">
        ${postCards}
      </div>
      ${paginationHtml}
    </main>
  </section>`;
};
