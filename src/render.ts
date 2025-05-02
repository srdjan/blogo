import { Post, RenderContext, TagInfo } from "./types.ts";
import type { Pagination } from "./pagination.ts";
import {
  generateBlogPostSchema,
  generateOpenGraphTags,
  generateTwitterCardTags,
  generateWebsiteSchema,
} from "./metadata.ts";

/**
 * Shared HTML templates for reuse across rendering functions
 */
const TEMPLATES = {
  head: (
    title: string,
    description: string,
    structuredData: string,
    ogTags: string,
    twitterTags: string,
    siteName: string,
  ) => `
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">

    <!-- Structured Data -->
    <script type="application/ld+json">${structuredData}</script>

    <!-- Open Graph tags -->
    ${ogTags}

    <!-- Twitter Card tags -->
    ${twitterTags}

    <link rel="stylesheet" href="/css/main.css">
    <link rel="alternate" type="application/rss+xml" title="${siteName} RSS Feed" href="/feed.xml">
    <script src="/js/htmx.min.js"></script>
    <script src="/js/site.js"></script>
  </head>`,

  // Navigation
  nav: () => `
  <header id="site-header">
    <nav>
      <div class="nav-links">
        <a href="/" class="link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Home</a>
        <a href="/tags" class="link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Tags</a>
        <a href="/about" class="link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">About</a>
        <button class="search-toggle link" aria-label="Search" aria-expanded="false"
          onclick="document.getElementById('search-modal').style.display='flex'">Search</button>
        <a href="/feed.xml" class="link">RSS</a>
      </div>
    </nav>
    <div id="search-modal" class="search-modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="search-heading">
      <div class="search-modal-content">
        <div class="search-header">
          <h2 id="search-heading">Search</h2>
          <button class="search-close" aria-label="Close search"
            onclick="document.getElementById('search-modal').style.display='none'">✕ Close</button>
        </div>
        <form class="search-form" id="search-form" role="search">
          <input type="search" name="q" placeholder="Search posts..." required id="search-input"
            autofocus aria-labelledby="search-heading">
          <button type="submit" aria-label="Submit search">Search</button>
        </form>
        <div id="search-results" class="search-results" aria-live="polite" role="region" aria-label="Search results"></div>
      </div>
    </div>
  </header>`,

  // Footer
  footer: () => `
  <footer>
    <p>Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
      <span class="avatar">⊣˚∆˚⊢</span></a> & Claude</p>
  </footer>`,

  // Post meta information (date and tags)
  postMeta: (post: Post) => `
  <div class="post-meta">
    <time datetime="${post.date}">${post.formattedDate || new Date(post.date).toLocaleDateString()}</time>
    ${post.tags ? renderTags(post.tags) : ""}
  </div>`,

  // Post excerpt
  postExcerpt: (excerpt: string) => `<p class="post-excerpt">${excerpt}</p>`,

  // Return home link
  returnHomeLink: () => `<a href="/" class="button link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Return Home</a>`,

  // Pagination components
  pagination: {
    prevLink: (currentPage: number) => `
      <a href="?page=${currentPage - 1}" class="pagination-prev link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML" aria-label="Previous page">
        Previous
      </a>
    `,
    prevDisabled: () => `
      <span class="pagination-prev pagination-disabled" aria-disabled="true">
        Previous
      </span>
    `,
    nextLink: (currentPage: number) => `
      <a href="?page=${currentPage + 1}" class="pagination-next link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML" aria-label="Next page">
        Next
      </a>
    `,
    nextDisabled: () => `
      <span class="pagination-next pagination-disabled" aria-disabled="true">
        Next
      </span>
    `,
    pageLink: (page: number) => `<a href="?page=${page}" class="link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">${page}</a>`,
    currentPage: (page: number) => `<span class="pagination-current" aria-current="page">${page}</span>`,
    ellipsis: () => `<span class="pagination-ellipsis">&hellip;</span>`,
    info: (currentPage: number, totalPages: number) => `<div class="pagination-info"><p>Page ${currentPage} of ${totalPages}</p></div>`,
  },

  // Tag components
  tag: (tag: string) => `
    <a href="/tags/${tag}" class="tag link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">
      ${tag}
    </a>
  `,

  // Tag with count for tag cloud
  tagWithCount: (tag: TagInfo, sizeClass: string) => `
    <a href="/tags/${tag.name}"
      class="tag tag-${sizeClass} link"
      hx-boost="true"
      hx-target="#content-main"
      hx-swap="innerHTML"
      title="${tag.count} posts">
      ${tag.name}
      <span class="tag-count">${tag.count}</span>
    </a>
  `,
};

/**
 * Render the HTML document shell with neobrutalist styling
 * Uses a pure functional approach with explicit type signatures
 */
export const renderDocument = (
  context: RenderContext,
  content: string,
  config: {
    baseUrl: string;
    description: string;
  },
): string => {
  // Determine title based on context
  const pageTitle = context.post
    ? `${context.post.title} - ${context.title}`
    : context.title;

  // Determine description based on context
  const pageDescription = context.post
    ? (context.post.excerpt || config.description)
    : config.description;

  // Generate structured data
  const structuredData = context.post
    ? generateBlogPostSchema(context.post, config.baseUrl)
    : generateWebsiteSchema(context.title, config.baseUrl, config.description);

  // Generate OpenGraph and Twitter Card tags
  const ogTags = generateOpenGraphTags(
    pageTitle,
    `${config.baseUrl}${context.path}`,
    pageDescription,
    context.post ? "article" : "website",
  );

  const twitterTags = generateTwitterCardTags(
    pageTitle,
    pageDescription,
  );

  // Compose the full HTML document from template parts
  return `<!DOCTYPE html>
<html lang="en">
${TEMPLATES.head(
    pageTitle,
    pageDescription,
    structuredData,
    ogTags,
    twitterTags,
    context.title,
  )
    }
<body>
  ${TEMPLATES.nav()}
  <main id="content-main" class="htmx-swappable content-main">${content}</main>
  ${TEMPLATES.footer()}
</body>
</html>`;
};

/**
 * Additional template components to render post-related UI
 */
const POST_TEMPLATES = {
  // Post card component
  postCard: (post: Post): string => `
    <article class="post-card">
      <div class="post-card-inner">
        <h2><a href="/posts/${post.slug}" class="link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">${post.title}</a></h2>
        ${TEMPLATES.postMeta(post)}
        ${post.excerpt ? TEMPLATES.postExcerpt(post.excerpt) : ""}
      </div>
    </article>`,

  // Empty state component
  emptyState: (activeTag?: string): string => `
    <div class="empty-state">
      <p>No posts found${activeTag ? ` tagged with "${activeTag}"` : ""}.</p>
    </div>`,

  // Tag filter header component
  tagHeader: (activeTag: string, postCount: number): string => `
    <h1>Posts Tagged "${activeTag}"</h1>
    <div class="tag-filter-header">
      <p>Showing ${postCount} post${postCount !== 1 ? "s" : ""} tagged with <strong>${activeTag}</strong></p>
      <a href="/" class="button link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Show All Posts</a>
    </div>`,
};

/**
 * Render the post list for the home page or filtered by tag
 * Pure function implementation with explicit type modeling
 */
export const renderPostList = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination,
): string => {
  // Prepare post cards - only generate HTML when needed
  const postCards = posts.length > 0
    ? posts.map((post) => POST_TEMPLATES.postCard(post)).join("")
    : POST_TEMPLATES.emptyState(activeTag);

  // Prepare tag header if needed
  const tagHeader = activeTag
    ? POST_TEMPLATES.tagHeader(activeTag, posts.length)
    : "";

  // Prepare pagination if needed
  const paginationHtml = pagination ? renderPagination(pagination) : "";

  // Compose the final HTML
  return `
    <section class="post-list content-section">
      <div class="content-wrapper">
        ${tagHeader}
        <div class="post-cards-container">
          ${postCards}
        </div>
        ${paginationHtml}
      </div>
    </section>
  `;
};

/**
 * Render pagination controls
 * Type-safe implementation with proper accessibility support
 */
export const renderPagination = (pagination: Pagination): string => {
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

  return `
    <nav class="pagination content-section" aria-label="Pagination Navigation">
      ${hasPrevPage ? TEMPLATES.pagination.prevLink(currentPage) : TEMPLATES.pagination.prevDisabled()}

      <div class="pagination-pages">
        ${pageNumbers.map((page) =>
    page === null
      ? TEMPLATES.pagination.ellipsis()
      : page === currentPage
        ? TEMPLATES.pagination.currentPage(page)
        : TEMPLATES.pagination.pageLink(page)
  ).join("")}
      </div>

      ${hasNextPage ? TEMPLATES.pagination.nextLink(currentPage) : TEMPLATES.pagination.nextDisabled()}

      ${TEMPLATES.pagination.info(currentPage, totalPages)}
    </nav>
  `;
};

/**
 * Render a single post
 * Pure function that transforms Post -> HTML
 */
export const renderPost = (post: Post): string => {
  return `
    <article class="post content-section">
      <header class="post-header">
        <h1>${post.title}</h1>
        ${TEMPLATES.postMeta(post)}
      </header>
      <div class="post-content">
        ${post.content}
      </div>
    </article>
  `;
};

/**
 * Render a 404 page
 * Stateless function with implicit unit input
 */
export const renderNotFound = (): string => {
  return `
    <section class="not-found content-section">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p>${TEMPLATES.returnHomeLink()}</p>
    </section>
  `;
};

/**
 * Render the about page
 * Stateless function with implicit unit input
 */
export const renderAbout = (): string => {
  return `
    <section class="about content-section">
      <h1>About This Blog</h1>
      <p>This is a minimal blog built with Deno, HTMX, and Markdown.</p>
      <p>The architecture follows functional programming principles with immutable data structures, pure functions, and strong type safety throughout.</p>
      <p>The design uses a neobrutalist approach with bold colors, thick borders, and raw typography.</p>
    </section>
  `;
};

/**
 * Render the tag index page
 * Type-safe function mapping TagInfo[] -> HTML
 */
export const renderTagIndex = (tags: TagInfo[]): string => {
  return `
    <section class="tag-index content-section">
      <h1>Tags</h1>
      <div class="tag-cloud">
        ${tags
      .sort((a, b) => b.count - a.count)
      .map((tag) => TEMPLATES.tagWithCount(tag, sizeClassForCount(tag.count)))
      .join("")
    }
      </div>
    </section>
  `;
};

/**
 * Render search results
 * Pure function with Posts and query string -> HTML
 */
export const renderSearchResults = (posts: Post[], query: string): string => {
  if (!query || query.trim().length === 0) {
    return "";
  }

  if (posts.length === 0) {
    return `
      <div class="search-results-summary content-section">
        No posts found matching "${query}"
      </div>
    `;
  }

  return `
    <div class="search-results-summary content-section">
      Found ${posts.length} post${posts.length !== 1 ? "s" : ""} matching "${query}"
    </div>
    ${posts.map((post) => `
      <article class="search-result">
        <h3><a href="/posts/${post.slug}" class="link" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">${post.title}</a></h3>
        ${TEMPLATES.postMeta(post)}
        ${post.excerpt ? TEMPLATES.postExcerpt(post.excerpt) : ""}
      </article>
    `).join("")}
  `;
};

/**
 * Render an error page
 * Type-safe error display with optional stack trace
 */
export const renderErrorPage = (error: {
  title: string;
  message: string;
  stackTrace?: string;
}): string => {
  return `
    <section class="error-page content-section">
      <h1>${error.title}</h1>
      <div class="error-message">
        <p>${error.message}</p>
      </div>
      ${error.stackTrace
      ? `
        <details class="error-details">
          <summary>Technical Details</summary>
          <pre class="error-stack">${error.stackTrace}</pre>
        </details>
      `
      : ""
    }
      <p>${TEMPLATES.returnHomeLink()}</p>
    </section>
  `;
};

/**
 * Helper function to render tags
 * Pure function that maps string[] -> HTML
 */
const renderTags = (tags: string[]): string => {
  return `
    <div class="tags content-section">
      ${tags.map((tag) => TEMPLATES.tag(tag)).join("")}
    </div>
  `;
};

/**
 * Helper function to determine tag size class based on count
 * Pure function with numeric input -> string output
 */
const sizeClassForCount = (count: number): string => {
  if (count >= 10) return "lg";
  if (count >= 5) return "md";
  return "sm";
};
