import { RenderContext, Post, TagInfo } from "./types.ts";
import type { Pagination } from "./pagination.ts";
import {
  generateWebsiteSchema,
  generateBlogPostSchema,
  generateOpenGraphTags,
  generateTwitterCardTags,
} from "./metadata.ts";

/**
 * Render the HTML document shell
 */
export const renderDocument = (
  context: RenderContext,
  content: string,
  config: {
    baseUrl: string;
    description: string;
  }
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
    context.post ? "article" : "website"
  );

  const twitterTags = generateTwitterCardTags(
    pageTitle,
    pageDescription
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
    ${structuredData}
  </script>
  
  <!-- Open Graph tags -->
  ${ogTags}
  
  <!-- Twitter Card tags -->
  ${twitterTags}
  
  <link rel="stylesheet" href="/css/main.css">
  <link rel="alternate" type="application/rss+xml" title="${context.title} RSS Feed" href="/feed.xml">
  <script src="/js/htmx.min.js"></script>
</head>
<body>
  <header>
    <nav>
      <a href="/" class="site-title" hx-boost="true">${context.title}</a>
      <div class="nav-links">
        <a href="/" hx-boost="true">Home</a>
        <a href="/tags" hx-boost="true">Tags</a>
        <a href="/about" hx-boost="true">About</a>
        <a href="/feed.xml" class="rss-link">RSS</a>
      </div>
    </nav>
    ${renderSearchForm()}
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>Built with Deno, HTMX and Markdown</p>
  </footer>
  </body>
</html>`;
};

/**
 * Render the post list for the home page or filtered by tag
 */
export const renderPostList = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination
): string => {
  return `
    <section class="post-list">
      <h1>${activeTag ? `Posts Tagged "${activeTag}"` : "Latest Posts"}</h1>
      
      ${activeTag ? `
        <div class="tag-filter-header">
          <p>Showing ${posts.length} post${posts.length !== 1 ? 's' : ''} tagged with <strong>${activeTag}</strong></p>
          <a href="/" class="button" hx-boost="true">Show All Posts</a>
        </div>
      ` : ''}
      
      ${posts.length === 0 ? `
        <div class="empty-state">
          <p>No posts found${activeTag ? ` tagged with "${activeTag}"` : ''}.</p>
        </div>
      ` : ''}
      
      ${posts
      .map(
        post => `
      <article class="post-card">
        <h2><a href="/posts/${post.slug}" hx-boost="true">${post.title}</a></h2>
        <div class="post-meta">
          <time datetime="${post.date}">${new Date(post.date).toLocaleDateString()}</time>
          ${post.tags ? renderTags(post.tags) : ""}
        </div>
        ${post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : ""}
      </article>`
      )
      .join("")}
      
      ${pagination ? renderPagination(pagination) : ''}
    </section>
  `;
};

/**
 * Render pagination controls
 */
export const renderPagination = (pagination: Pagination): string => {
  const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

  // Don't render pagination if there's only one page
  if (totalPages <= 1) {
    return '';
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
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
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
    <nav class="pagination" aria-label="Pagination Navigation">
      ${hasPrevPage ? `
        <a href="?page=${currentPage - 1}" class="pagination-prev" hx-boost="true" aria-label="Previous page">
          &larr; Previous
        </a>
      ` : `
        <span class="pagination-prev pagination-disabled" aria-disabled="true">
          &larr; Previous
        </span>
      `}
      
      <div class="pagination-pages">
        ${pageNumbers.map(page =>
    page === null
      ? `<span class="pagination-ellipsis">&hellip;</span>`
      : page === currentPage
        ? `<span class="pagination-current" aria-current="page">${page}</span>`
        : `<a href="?page=${page}" hx-boost="true">${page}</a>`
  ).join('')}
      </div>
      
      ${hasNextPage ? `
        <a href="?page=${currentPage + 1}" class="pagination-next" hx-boost="true" aria-label="Next page">
          Next &rarr;
        </a>
      ` : `
        <span class="pagination-next pagination-disabled" aria-disabled="true">
          Next &rarr;
        </span>
      `}
      
      <div class="pagination-info">
        <p>Page ${currentPage} of ${totalPages}</p>
      </div>
    </nav>
  `;
};

/**
 * Render a single post
 */
export const renderPost = (post: Post): string => {
  return `
    <article class="post">
      <header class="post-header">
        <h1>${post.title}</h1>
        <div class="post-meta">
          <time datetime="${post.date}">${new Date(post.date).toLocaleDateString()}</time>
          ${post.tags ? renderTags(post.tags) : ""}
        </div>
      </header>
      <div class="post-content">
        ${post.content}
      </div>
    </article>
  `;
};

/**
 * Render a 404 page
 */
export const renderNotFound = (): string => {
  return `
    <section class="not-found">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p><a href="/">Return to home</a></p>
    </section>
  `;
};

/**
 * Render the about page
 */
export const renderAbout = (): string => {
  return `
    <section class="about">
      <h1>About This Blog</h1>
      <p>This is a minimal blog built with Deno, HTMX, and Markdown.</p>
    </section>
  `;
};

/**
 * Render the tag index page
 */
export const renderTagIndex = (tags: TagInfo[]): string => {
  return `
    <section class="tag-index">
      <h1>Tags</h1>
      <div class="tag-cloud">
        ${tags
      .sort((a, b) => b.count - a.count)
      .map(
        tag => `
        <a href="/tags/${tag.name}" 
          class="tag tag-${sizeClassForCount(tag.count)}" 
          hx-boost="true"
          title="${tag.count} posts">
          ${tag.name}
          <span class="tag-count">${tag.count}</span>
        </a>`
      )
      .join("")}
      </div>
    </section>
  `;
};

/**
 * Render search form
 */
export const renderSearchForm = (): string => {
  return `
    <div class="search-container">
      <form class="search-form" hx-get="/search" hx-trigger="submit" hx-target="#search-results" hx-swap="innerHTML">
        <input 
          type="search" 
          name="q" 
          placeholder="Search posts..." 
          required
          hx-get="/search" 
          hx-trigger="keyup changed delay:500ms" 
          hx-target="#search-results"
          hx-include="closest form"
        >
        <button type="submit">Search</button>
      </form>
      <div id="search-results" class="search-results"></div>
    </div>
  `;
};

/**
 * Render search results
 */
export const renderSearchResults = (posts: Post[], query: string): string => {
  if (!query || query.trim().length === 0) {
    return '';
  }

  if (posts.length === 0) {
    return `
      <div class="search-results-summary">
        No posts found matching "${query}"
      </div>
    `;
  }

  return `
    <div class="search-results-summary">
      Found ${posts.length} post${posts.length !== 1 ? 's' : ''} matching "${query}"
    </div>
    ${posts.map(post => `
      <article class="search-result">
        <h3><a href="/posts/${post.slug}" hx-boost="true">${post.title}</a></h3>
        <div class="post-meta">
          <time datetime="${post.date}">${new Date(post.date).toLocaleDateString()}</time>
          ${post.tags ? renderTags(post.tags) : ""}
        </div>
        ${post.excerpt ? `<p class="search-excerpt">${post.excerpt}</p>` : ""}
      </article>
    `).join('')}
  `;
};

/**
 * Render an error page
 */
export const renderErrorPage = (error: {
  title: string;
  message: string;
  stackTrace?: string;
}): string => {
  return `
    <section class="error-page">
      <h1>${error.title}</h1>
      <div class="error-message">
        <p>${error.message}</p>
      </div>
      ${error.stackTrace ? `
        <details class="error-details">
          <summary>Technical Details</summary>
          <pre class="error-stack">${error.stackTrace}</pre>
        </details>
      ` : ''}
      <p><a href="/" class="button">Return Home</a></p>
    </section>
  `;
};

/**
 * Helper function to render tags
 */
const renderTags = (tags: string[]): string => {
  return `
    <div class="tags">
      ${tags.map(tag => `
        <a href="/tags/${tag}" class="tag" hx-boost="true">
          ${tag}
        </a>
      `).join("")}
    </div>
  `;
};

/**
 * Helper function to determine tag size class based on count
 */
const sizeClassForCount = (count: number): string => {
  if (count >= 10) return "lg";
  if (count >= 5) return "md";
  return "sm";
};