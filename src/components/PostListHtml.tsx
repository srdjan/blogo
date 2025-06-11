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
        "",
        `aria-label="Previous page"`,
      )
      : `<span aria-disabled="true">Previous</span>`;

    // Render page numbers
    const pageLinks = pageNumbers.map((page) => {
      if (page === null) {
        return `<span>&hellip;</span>`;
      }

      if (page === currentPage) {
        return `<span aria-current="page">${page}</span>`;
      }

      return createHtmxLink(`?page=${page}`, page.toString());
    }).join("");

    // Render next button
    const nextButton = hasNextPage
      ? createHtmxLink(
        `?page=${currentPage + 1}`,
        "Next",
        "",
        `aria-label="Next page"`,
      )
      : `<span aria-disabled="true">Next</span>`;

    return `<nav aria-label="pagination">
      ${prevButton}
      ${pageLinks}
      ${nextButton}
      <small>Page ${currentPage} of ${totalPages}</small>
    </nav>`;
  };

  // Render tag header
  let tagHeader = "";
  if (activeTag) {
    tagHeader = `
      <header>
        <h1>Posts Tagged "${activeTag}"</h1>
        <aside role="banner">
          <p>
            Showing ${posts.length} ${
      pluralize(posts.length, "post")
    } tagged with <strong>${activeTag}</strong>
          </p>
          ${createHtmxLink("/", "Show All Posts")}
        </aside>
      </header>
    `;
  }

  // Render post cards
  let postCards = "";
  if (posts.length > 0) {
    postCards = posts.map((post) => {
      const postMeta = renderPostMeta(post);
      const excerpt = renderPostExcerpt(post);

      return `<article>
        <header>
          <h2>
            ${createPostLink(post.slug, post.title)}
          </h2>
          ${postMeta}
        </header>
        ${excerpt}
      </article>`;
    }).join("");
  } else {
    postCards = `<aside>
      <p>No posts found${activeTag ? ` tagged with "${activeTag}"` : ""}.</p>
    </aside>`;
  }

  // Render pagination
  let paginationHtml = "";
  if (pagination) {
    paginationHtml = renderPagination(pagination);
  }

  // Render the complete post list
  return `<main>
    ${tagHeader}
    <section>
      ${postCards}
    </section>
    ${paginationHtml}
  </main>`;
};
