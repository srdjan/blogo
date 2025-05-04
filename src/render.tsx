import { Post, RenderContext, TagInfo } from "./types.ts";
import type { Pagination } from "./pagination.ts";
import {
  generateBlogPostSchema,
  generateOpenGraphTags,
  generateTwitterCardTags,
  generateWebsiteSchema,
} from "./metadata.ts";
import { Document } from "./components/Document.tsx";
import { PostContent } from "./components/Post.tsx";
import { renderPostListHtml } from "./components/PostListHtml.tsx";
import { renderAboutHtml } from "./components/AboutHtml.tsx";
import { renderNotFoundHtml } from "./components/NotFoundHtml.tsx";
import { renderTagIndexHtml } from "./components/TagIndexHtml.tsx";
import { renderSearchResultsHtml } from "./components/SearchResultsHtml.tsx";
import { renderErrorPageHtml } from "./components/ErrorPageHtml.tsx";

// These helper functions are no longer needed as they've been replaced by JSX components

/**
 * Render the HTML document shell
 * Uses JSX for declarative UI composition
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

  // Instead of using the Document component, directly create the HTML
  // This ensures we're returning a string and avoids mono-jsx issues
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}">
    ${structuredData ? `<script type="application/ld+json">${structuredData}</script>` : ''}
    ${ogTags || ''}
    ${twitterTags || ''}
    <link rel="stylesheet" href="/css/main.css">
    <link rel="stylesheet" href="/css/color-override.css">
    <link rel="stylesheet" href="/css/fonts.css">
    <link rel="alternate" href="/feed.xml" title="${pageTitle} RSS Feed">
    <script src="/js/htmx.min.js"></script>
    <script src="/js/site.js"></script>
  </head>
  <body>
    <div id="app-layout">
      <header id="site-header">
        <nav>
          <div class="nav-links">
            <a 
              href="/" 
              class="link${context.path === '/' ? ' active' : ''}" 
              hx-get="/" 
              hx-target="#content-area" 
              hx-swap="innerHTML" 
              hx-push-url="true"
            >
              Home
            </a>
            <a 
              href="/tags" 
              class="link${context.path === '/tags' ? ' active' : ''}" 
              hx-get="/tags" 
              hx-target="#content-area" 
              hx-swap="innerHTML" 
              hx-push-url="true"
            >
              Tags
            </a>
            <a 
              href="/about" 
              class="link${context.path === '/about' ? ' active' : ''}" 
              hx-get="/about" 
              hx-target="#content-area" 
              hx-swap="innerHTML" 
              hx-push-url="true"
            >
              About
            </a>
            <button
              type="button"
              class="search-toggle link"
              aria-label="Search"
              aria-expanded="false"
              onClick="document.getElementById('search-modal').style.display='flex'"
            >
              Search
            </button>
            <a href="/feed.xml" class="link">RSS</a>
          </div>
        </nav>
        <div id="search-modal" class="search-modal"></div>
      </header>

      <main id="content-main" class="content-main">
        <div id="content-area" class="htmx-swappable">
          ${content}
        </div>
      </main>

      <footer>
        <p>
          Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
            <span class="avatar">⊣˚∆˚⊢</span>
          </a> & Claude
        </p>
      </footer>
    </div>
  </body>
</html>`;
};

export const renderPost = (post: Post): string => {
  try {
    // Fall back to direct HTML content instead of using JSX
    // This bypasses mono-jsx completely for post content
    return `
      <article class="post content-section">
        <div class="post-meta-subtle">
          <time datetime="${post.date}">${post.formattedDate || post.date}</time>
          ${post.tags && post.tags.length > 0 ? `
            <div class="tags">
              ${post.tags.map(tag => `
                <a 
                  href="/tags/${tag}" 
                  class="tag link" 
                  hx-get="/tags/${tag}" 
                  hx-target="#content-area" 
                  hx-swap="innerHTML" 
                  hx-push-url="true"
                >
                  ${tag}
                </a>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="post-content">
          ${post.content}
        </div>
      </article>
    `;
  } catch (error) {
    console.error("Error rendering post:", error);
    // Fallback content
    return `<div class="post-error">Error rendering content</div>`;
  }
};

export const renderNotFound = (): string => {
  // Use the renderNotFoundHtml function from components/NotFoundHtml.tsx
  return renderNotFoundHtml();
};

export const renderAbout = (): string => {
  // Use the renderAboutHtml function from components/AboutHtml.tsx
  return renderAboutHtml();
};

export const renderTagIndex = (tags: TagInfo[]): string => {
  // Use the renderTagIndexHtml function from components/TagIndexHtml.tsx
  return renderTagIndexHtml(tags);
};

export const renderPostList = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination,
): string => {
  // Use the renderPostListHtml function from components/PostListHtml.tsx
  return renderPostListHtml(posts, activeTag, pagination);
};

export const renderSearchResults = (posts: Post[], query: string): string => {
  // Use the renderSearchResultsHtml function from components/SearchResultsHtml.tsx
  return renderSearchResultsHtml(posts, query);
};

export const renderErrorPage = (error: {
  title: string;
  message: string;
  stackTrace?: string;
}): string => {
  // Use the renderErrorPageHtml function from components/ErrorPageHtml.tsx
  return renderErrorPageHtml(error);
};
