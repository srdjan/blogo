import { Post, RenderContext, TagInfo } from "./types.ts";
import type { Pagination } from "./pagination.ts";
import {
  generateBlogPostSchema,
  generateOpenGraphTags,
  generateTwitterCardTags,
  generateWebsiteSchema,
} from "./metadata.ts";
import { renderPostListHtml } from "./components/PostListHtml.tsx";
import { renderAboutHtml } from "./components/AboutHtml.tsx";
import { renderNotFoundHtml } from "./components/NotFoundHtml.tsx";
import { renderTagIndexHtml } from "./components/TagIndexHtml.tsx";
import { renderSearchResultsHtml } from "./components/SearchResultsHtml.tsx";
import { renderErrorPageHtml } from "./components/ErrorPageHtml.tsx";

/**
 * Render the HTML document shell
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

  // Create the navbar HTML with active state handling
  const navHTML = `
    <nav>
      <ul>
        <li>
          <a
            href="/"
            class="link${context.path === "/" ? " active" : ""}"
            hx-get="/"
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            ◊ Home
          </a>
        </li>
        <li>
          <a
            href="/tags"
            class="link${context.path === "/tags" ? " active" : ""}"
            hx-get="/tags"
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            ◈ Tags
          </a>
        </li>
        <li>
          <a
            href="/about"
            class="link${context.path === "/about" ? " active" : ""}"
            hx-get="/about"
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            ◆ About
          </a>
        </li>
        <li>
          <button
            type="button"
            class="search-toggle link"
            aria-label="Search"
            aria-expanded="false"
            onClick="document.getElementById('search-modal').style.display='block'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>
          </button>
        </li>
        <li>
          <a href="/feed.xml" class="link" aria-label="RSS Feed">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rss-icon lucide-rss"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
          </a>
        </li>
      </ul>
    </nav>
  `;

  // Create the layout HTML
  const layoutHTML = `
    <div id="app-layout">
      <header id="site-header">
        ${navHTML}
        <dialog id="search-modal" aria-labelledby="search-heading">
          <section>
            <header>
              <h2 id="search-heading">Search</h2>
              <button
                type="button"
                aria-label="Close search"
                onClick="document.getElementById('search-modal').style.display='none'"
              >
                ✕
              </button>
            </header>
            <form id="search-form" role="search" action="/search">
              <input
                type="search"
                name="q"
                placeholder="Search posts..."
                required
                id="search-input"
                aria-labelledby="search-heading"
              />
              <button type="submit" aria-label="Submit search">Search</button>
            </form>
            <section
              id="search-results"
              role="region"
              aria-live="polite"
              aria-label="Search results"
            ></section>
          </section>
        </dialog>
      </header>

      <main id="content-main" class="content-main">
        <div id="content-area" class="htmx-swappable">
          ${content}
        </div>
      </main>

      <footer>
        <p>
          Claude &
          <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer"><span>⊣˚∆˚⊢</span></a>
          vibe coded together...
        </p>
      </footer>
    </div>
  `;

  // Create the full HTML document
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}">
    ${
    structuredData
      ? `<script type="application/ld+json">${structuredData}</script>`
      : ""
  }
    ${ogTags || ""}
    ${twitterTags || ""}
    <link rel="stylesheet" href="/css/main.css">
    <link rel="alternate" href="/feed.xml" title="${pageTitle} RSS Feed">
    <script src="/js/htmx.min.js"></script>
    <script src="/js/site.js"></script>
  </head>
  <body>
    ${layoutHTML}
  </body>
</html>`;
};

export const renderPost = (post: Post): string => {
  try {
    // Use plain HTML rendering rather than JSX component
    return `
      <article>
        <header class="post-meta-subtle">
          <time datetime="${post.date}">◐ ${
      post.formattedDate || post.date
    }</time>
          ${
      post.tags && post.tags.length > 0
        ? `
            <div class="tags">
              ${
          post.tags.map((tag) => `
                <a
                  href="/tags/${tag}"
                  class="tag link"
                  hx-get="/tags/${tag}"
                  hx-target="#content-area"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                >
                  # ${tag}
                </a>
              `).join(" • ")
        }
            </div>
          `
        : ""
    }
        </header>
        <section>
          ${post.content}
        </section>
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
