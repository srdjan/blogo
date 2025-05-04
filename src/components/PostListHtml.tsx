/**
 * PostList component using the html tag function
 */

import { Post } from "../types.ts";
import type { Pagination } from "../pagination.ts";
import { formatDate } from "../utils.ts";

export const renderPostListHtml = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination,
): string => {
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
      ? `<a
          href="?page=${currentPage - 1}"
          class="pagination-prev link"
          hx-get="?page=${currentPage - 1}"
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
          aria-label="Previous page"
        >
          Previous
        </a>`
      : `<span class="pagination-prev pagination-disabled" aria-disabled="true">
          Previous
        </span>`;
    
    // Render page numbers
    const pageLinks = pageNumbers.map(page => {
      if (page === null) {
        return `<span class="pagination-ellipsis">&hellip;</span>`;
      }
      
      if (page === currentPage) {
        return `<span class="pagination-current" aria-current="page">${page}</span>`;
      }
      
      return `<a
        href="?page=${page}"
        class="link"
        hx-get="?page=${page}"
        hx-target="#content-area"
        hx-swap="innerHTML"
        hx-push-url="true"
      >
        ${page}
      </a>`;
    }).join("");
    
    // Render next button
    const nextButton = hasNextPage
      ? `<a
          href="?page=${currentPage + 1}"
          class="pagination-next link"
          hx-get="?page=${currentPage + 1}"
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
          aria-label="Next page"
        >
          Next
        </a>`
      : `<span class="pagination-next pagination-disabled" aria-disabled="true">
          Next
        </span>`;
    
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
            Showing ${posts.length} post${posts.length !== 1 ? "s" : ""} tagged with <strong>${activeTag}</strong>
          </p>
          <a 
            href="/" 
            class="button link" 
            hx-get="/" 
            hx-target="#content-area" 
            hx-swap="innerHTML" 
            hx-push-url="true"
          >
            Show All Posts
          </a>
        </div>
      </div>
    `;
  }
  
  // Render post cards
  let postCards = "";
  if (posts.length > 0) {
    postCards = posts.map(post => {
      const formattedDate = post.formattedDate || formatDate(post.date);
      const tags = post.tags ? renderTags(post.tags) : "";
      const excerpt = post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : "";
      
      return `<article class="post-card">
        <div class="post-card-inner">
          <h2>
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
          </h2>
          <div class="post-meta">
            <time datetime="${post.date}">${formattedDate}</time>
            ${tags}
          </div>
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
  return `<section class="post-list content-section">
    <div class="content-wrapper">
      ${tagHeader}
      <div class="post-cards-container">
        ${postCards}
      </div>
      ${paginationHtml}
    </div>
  </section>`;
};
