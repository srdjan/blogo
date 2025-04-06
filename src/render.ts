// src/render.ts - HTML rendering functions with type-safe functional approach
import { RenderContext, Post, TagInfo } from "./types.ts";
import type { Pagination } from "./pagination.ts";
import {
  generateWebsiteSchema,
  generateBlogPostSchema,
  generateOpenGraphTags,
  generateTwitterCardTags,
} from "./metadata.ts";

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
  
  <!-- System fonts -->
  
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
  
  <!-- HTMX scroll and accessibility management -->
  <script>
    document.addEventListener('htmx:afterSwap', function(event) {
      if (event.detail.target.tagName === 'MAIN') {
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
    });
    
    // Accessibility: Modal focus trap for search popup
    document.addEventListener('htmx:afterSettle', function(event) {
      if (event.target.id === 'search-popup' && event.target.querySelector('.search-modal')) {
        trapFocus(event.target.querySelector('.search-modal'));
      }
    });
    
    // Focus trap implementation
    function trapFocus(element) {
      // Find all focusable elements
      const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableContent = element.querySelectorAll(focusableElements);
      const firstFocusableElement = focusableContent[0];
      const lastFocusableElement = focusableContent[focusableContent.length - 1];
      
      // Focus the first element
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      }
      
      // Save last active element to restore focus when modal closes
      const previouslyFocused = document.activeElement;
      
      // Handle keydown events for tab key to create a focus trap
      element.addEventListener('keydown', function(e) {
        // If Escape is pressed, close the modal
        if (e.key === 'Escape') {
          const closeButton = element.querySelector('.search-close');
          if (closeButton) {
            closeButton.click();
          }
        }
        
        // Only handle Tab key
        if (e.key !== 'Tab') return;
        
        // If Shift + Tab on first element, move to last element
        if (e.shiftKey && document.activeElement === firstFocusableElement) {
          e.preventDefault();
          lastFocusableElement.focus();
        } 
        // If Tab on last element, move to first element
        else if (!e.shiftKey && document.activeElement === lastFocusableElement) {
          e.preventDefault();
          firstFocusableElement.focus();
        }
      });
      
      // Clean up when modal closes
      document.addEventListener('htmx:beforeSwap', function cleanup(evt) {
        if (evt.target.id === 'search-popup' && !evt.detail.xhr.responseText) {
          // Restore focus to previously focused element
          if (previouslyFocused) {
            previouslyFocused.focus();
          }
          // Remove this event listener
          document.removeEventListener('htmx:beforeSwap', cleanup);
        }
      });
    }
  </script>
</head>
<body>
  <header id="site-header">
    <nav>
      <a href="/" class="site-title" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">
        ${context.title}
      </a>
      <div class="nav-links">
        <a href="/" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Home</a>
        <a href="/tags" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Tags</a>
        <a href="/about" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">About</a>
        <button 
          class="search-toggle" 
          aria-label="Search" 
          aria-expanded="false"
          hx-get="/search-fragment"
          hx-target="#search-popup"
          hx-trigger="click"
          hx-swap="innerHTML">
          Search
        </button>
        <a href="/feed.xml" class="rss-link">RSS</a>
      </div>
    </nav>
    <div id="search-popup" class="search-popup"></div>
  </header>
  
  <!-- Explicit spacer element to maintain header clearance -->
  <div class="header-spacer" aria-hidden="true"></div>
  
  <main id="content-main" class="htmx-swappable">
    ${content}
  </main>
  <footer>
    <p>Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">⊣˚∆˚⊢</a> & Cloude</p>
  </footer>
</body>
</html>`;
};

/**
 * Render the post list for the home page or filtered by tag
 * Pure function implementation with explicit type modeling
 */
export const renderPostList = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination
): string => {
  return `
    <section class="post-list content-section">
      <div class="content-wrapper">
        ${activeTag ? `
          <h1>Posts Tagged "${activeTag}"</h1>
          <div class="tag-filter-header">
            <p>Showing ${posts.length} post${posts.length !== 1 ? 's' : ''} tagged with <strong>${activeTag}</strong></p>
            <a href="/" class="button" hx-boost="true" hx-target="#content-main" hx-swap="innerHTML">Show All Posts</a>
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
        <h2><a href="/posts/${post.slug}" hx-boost="true" hx-target="main" hx-swap="innerHTML">${post.title}</a></h2>
        <div class="post-meta">
          <time datetime="${post.date}">${post.formattedDate || new Date(post.date).toLocaleDateString()}</time>
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
 * Type-safe implementation with proper accessibility support
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
    <nav class="pagination content-section" aria-label="Pagination Navigation">
      ${hasPrevPage ? `
        <a href="?page=${currentPage - 1}" class="pagination-prev" hx-boost="true" hx-target="main" hx-swap="innerHTML" aria-label="Previous page">
          Previous
        </a>
      ` : `
        <span class="pagination-prev pagination-disabled" aria-disabled="true">
          Previous
        </span>
      `}
      
      <div class="pagination-pages">
        ${pageNumbers.map(page =>
    page === null
      ? `<span class="pagination-ellipsis">&hellip;</span>`
      : page === currentPage
        ? `<span class="pagination-current" aria-current="page">${page}</span>`
        : `<a href="?page=${page}" hx-boost="true" hx-target="main" hx-swap="innerHTML">${page}</a>`
  ).join('')}
      </div>
      
      ${hasNextPage ? `
        <a href="?page=${currentPage + 1}" class="pagination-next" hx-boost="true" hx-target="main" hx-swap="innerHTML" aria-label="Next page">
          Next
        </a>
      ` : `
        <span class="pagination-next pagination-disabled" aria-disabled="true">
          Next
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
 * Pure function that transforms Post -> HTML
 */
export const renderPost = (post: Post): string => {
  return `
    <article class="post content-section">
      <header class="post-header">
        <h1>${post.title}</h1>
        <div class="post-meta">
          <time datetime="${post.date}">${post.formattedDate || new Date(post.date).toLocaleDateString()}</time>
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
 * Stateless function with implicit unit input
 */
export const renderNotFound = (): string => {
  return `
    <section class="not-found content-section">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p><a href="/" hx-boost="true" hx-target="main" hx-swap="innerHTML" class="button">Return Home</a></p>
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
      .map(
        tag => `
        <a href="/tags/${tag.name}" 
          class="tag tag-${sizeClassForCount(tag.count)}" 
          hx-boost="true"
          hx-target="main"
          hx-swap="innerHTML"
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
 * Render search popup fragment
 * Pure function for HTMX-driven modal
 */
export const renderSearchPopup = (): string => {
  return `
    <div class="search-container" hx-swap-oob="true">
      <div class="search-overlay" 
           hx-get="/search-close" 
           hx-target="#search-popup" 
           hx-trigger="click"
           role="button"
           aria-label="Close search overlay"></div>
      <div class="search-modal" 
           role="dialog" 
           aria-modal="true" 
           aria-labelledby="search-heading">
        <div class="search-header">
          <h2 id="search-heading">Search Posts</h2>
          <button 
            class="search-close" 
            aria-label="Close search" 
            hx-get="/search-close" 
            hx-target="#search-popup" 
            hx-trigger="click">
            Close
          </button>
        </div>
        <form class="search-form" 
              hx-get="/search" 
              hx-trigger="submit" 
              hx-target="#search-results" 
              hx-swap="innerHTML">
          <input 
            type="search" 
            name="q" 
            placeholder="Search posts..." 
            required
            hx-get="/search" 
            hx-trigger="keyup changed delay:500ms" 
            hx-target="#search-results"
            hx-include="closest form"
            autofocus
            aria-labelledby="search-heading"
          >
          <button type="submit">Search</button>
        </form>
        <div id="search-results" class="search-results" aria-live="polite"></div>
      </div>
    </div>
  `;
};

/**
 * Render empty search fragment (for closing)
 * Zero-output function for modal dismissal
 */
export const renderSearchClose = (): string => {
  return '';
};

/**
 * Render search results
 * Pure function with Posts and query string -> HTML
 */
export const renderSearchResults = (posts: Post[], query: string): string => {
  if (!query || query.trim().length === 0) {
    return '';
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
      Found ${posts.length} post${posts.length !== 1 ? 's' : ''} matching "${query}"
    </div>
    ${posts.map(post => `
      <article class="search-result">
        <h3><a href="/posts/${post.slug}" hx-boost="true" hx-target="main" hx-swap="innerHTML">${post.title}</a></h3>
        <div class="post-meta">
          <time datetime="${post.date}">${post.formattedDate || new Date(post.date).toLocaleDateString()}</time>
          ${post.tags ? renderTags(post.tags) : ""}
        </div>
        ${post.excerpt ? `<p class="search-excerpt">${post.excerpt}</p>` : ""}
      </article>
    `).join('')}
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
      ${error.stackTrace ? `
        <details class="error-details">
          <summary>Technical Details</summary>
          <pre class="error-stack">${error.stackTrace}</pre>
        </details>
      ` : ''}
      <p><a href="/" class="button" hx-boost="true" hx-target="main" hx-swap="innerHTML">Return Home</a></p>
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
      ${tags.map(tag => `
        <a href="/tags/${tag}" class="tag" hx-boost="true" hx-target="main" hx-swap="innerHTML">
          ${tag}
        </a>
      `).join("")}
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