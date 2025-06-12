// New mono-jsx entry point
import { createBlogLayout } from "./src/utils/layout-helpers.tsx";
import { createAbout, createPostList, createTagIndex, createSearchResults } from "./src/utils/render-helpers.tsx";
import { getCachedPosts, getCachedTags, getPostBySlug, getPostsByTag, searchPostsByQuery } from "./src/utils/content-loader.ts";
import { generateRSS } from "./src/rss.ts";

export default {
  async fetch(req: Request) {
    const url = new URL(req.url);
    
    console.log(`mono-jsx: ${req.method} ${url.pathname}`);
    
    // Handle static files
    if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
      try {
        // Files are in public/ directory, so map /css/main.css to public/css/main.css
        const filePath = `public${url.pathname}`;
        console.log(`Trying to serve static file: ${filePath}`);
        
        const file = await Deno.readFile(filePath);
        const ext = filePath.split('.').pop();
        
        let contentType = 'text/plain';
        if (ext === 'css') contentType = 'text/css';
        else if (ext === 'js') contentType = 'application/javascript';
        else if (ext === 'html') contentType = 'text/html';
        
        return new Response(file, {
          headers: { 'Content-Type': contentType }
        });
      } catch (error) {
        console.log(`Static file not found: ${url.pathname}, error:`, error instanceof Error ? error.message : String(error));
        return new Response('File not found', { status: 404 });
      }
    }
    
    // Handle test route with full blog layout
    if (url.pathname === '/mono-test') {
      return createBlogLayout(
        {
          title: "Layout Test - Blog",
          description: "Testing the full blog layout helper function",
          path: url.pathname
        },
        <main>
          <h1>🎉 Full Blog Layout Working!</h1>
          <p>This page uses the complete blog layout with all features:</p>
          <ul>
            <li>✅ Unicode symbols in navigation</li>
            <li>✅ HTMX attributes</li>
            <li>✅ Search modal</li>
            <li>✅ SVG icons</li>
            <li>✅ Active navigation states</li>
            <li>✅ All CSS and JavaScript</li>
          </ul>
          <p>Try clicking the navigation links and search button!</p>
        </main>
      );
    }
    
    // Handle root route with real blog posts
    if (url.pathname === '/') {
      const posts = await getCachedPosts();
      
      return createBlogLayout(
        {
          title: "Blog - Home",
          description: "A minimal blog built with mono-jsx",
          path: url.pathname
        },
        createPostList(posts)
      );
    }

    // Handle tags route with real tags
    if (url.pathname === '/tags') {
      const tags = await getCachedTags();
      
      return createBlogLayout(
        {
          title: "Tags - Blog",
          description: "Browse posts by tags",
          path: url.pathname
        },
        createTagIndex(tags)
      );
    }

    // Handle about route with blog layout
    if (url.pathname === '/about') {
      return createBlogLayout(
        {
          title: "About - Blog",
          description: "About this blog and its features",
          path: url.pathname
        },
        createAbout()
      );
    }

    // Handle individual post routes: /posts/slug
    if (url.pathname.startsWith('/posts/')) {
      const slug = url.pathname.replace('/posts/', '');
      const post = await getPostBySlug(slug);
      
      if (!post) {
        return new Response('Post not found', { status: 404 });
      }
      
      // Create complete HTML document with embedded post content
      const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title} - Blog</title>
    <meta name="description" content="${post.excerpt || `Read ${post.title}`}">
    <link rel="stylesheet" href="/css/main.css">
    <link rel="alternate" href="/feed.xml" title="Blog RSS Feed">
    <script src="/js/htmx.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <script src="/js/site.js"></script>
  </head>
  <body>
    <div id="app-layout">
      <header id="site-header">
        <nav>
          <ul>
            <li>
              <a href="/" class="link" hx-get="/" hx-target="#content-area" hx-swap="innerHTML" hx-push-url="true">
                ◊ Home
              </a>
            </li>
            <li>
              <a href="/tags" class="link" hx-get="/tags" hx-target="#content-area" hx-swap="innerHTML" hx-push-url="true">
                ◈ Tags
              </a>
            </li>
            <li>
              <a href="/about" class="link" hx-get="/about" hx-target="#content-area" hx-swap="innerHTML" hx-push-url="true">
                ◆ About
              </a>
            </li>
            <li>
              <button type="button" class="search-toggle link" aria-label="Search" aria-expanded="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search">
                  <path d="m21 21-4.34-4.34"/>
                  <circle cx="11" cy="11" r="8"/>
                </svg>
              </button>
            </li>
            <li>
              <a href="/feed.xml" class="link" aria-label="RSS Feed">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rss-icon lucide-rss">
                  <path d="M4 11a9 9 0 0 1 9 9"/>
                  <path d="M4 4a16 16 0 0 1 16 16"/>
                  <circle cx="5" cy="19" r="1"/>
                </svg>
              </a>
            </li>
          </ul>
        </nav>
        
        <dialog id="search-modal" aria-labelledby="search-heading">
          <section>
            <header>
              <h2 id="search-heading">Search</h2>
              <button type="button" aria-label="Close search">✕</button>
            </header>
            <form id="search-form" role="search" action="/search">
              <input type="search" name="q" placeholder="Search posts..." required id="search-input" aria-labelledby="search-heading" />
              <button type="submit" aria-label="Submit search">Search</button>
            </form>
            <section id="search-results" role="region" aria-live="polite" aria-label="Search results"></section>
          </section>
        </dialog>
      </header>

      <main id="content-main" class="content-main">
        <div id="content-area" class="htmx-swappable">
          <article>
            <header class="post-meta-subtle">
              <div class="post-meta">
                <time dateTime="${post.date}">${post.formattedDate || new Date(post.date).toLocaleDateString()}</time>
                ${post.tags && post.tags.length > 0 ? `
                  <div class="post-tags">
                    ${post.tags.map(tag => `<a href="/tags/${tag}" class="tag-link">#${tag}</a>`).join(' ')}
                  </div>
                ` : ''}
              </div>
            </header>
            <section>
              ${post.content}
            </section>
          </article>
        </div>
      </main>

      <footer>
        <p>
          Claude &
          <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
            <span>⊣˚∆˚⊢</span>
          </a>
          vibe coded together...
        </p>
      </footer>
    </div>
  </body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Handle tag routes: /tags/tagname
    if (url.pathname.startsWith('/tags/') && url.pathname !== '/tags') {
      const tagName = decodeURIComponent(url.pathname.replace('/tags/', ''));
      const posts = await getPostsByTag(tagName);
      
      return createBlogLayout(
        {
          title: `Posts tagged "${tagName}" - Blog`,
          description: `All posts tagged with ${tagName}`,
          path: url.pathname
        },
        createPostList(posts, tagName)
      );
    }

    // Handle search requests: /search?q=query
    if (url.pathname === '/search') {
      const query = url.searchParams.get('q');
      
      if (!query) {
        return createBlogLayout(
          {
            title: "Search - Blog",
            description: "Search blog posts",
            path: url.pathname
          },
          <main>
            <h1>Search</h1>
            <p>Please provide a search query.</p>
            <a href="/">← Back to home</a>
          </main>
        );
      }
      
      const posts = await searchPostsByQuery(query);
      
      return createBlogLayout(
        {
          title: `Search: "${query}" - Blog`,
          description: `Search results for ${query}`,
          path: url.pathname
        },
        createSearchResults(posts, query)
      );
    }

    // Handle RSS feed
    if (url.pathname === '/feed.xml') {
      const posts = await getCachedPosts();
      const baseUrl = url.origin;
      const rssContent = generateRSS(
        posts,
        "Blog",
        baseUrl,
        "A minimal blog built with mono-jsx"
      );

      return new Response(rssContent, {
        headers: { 
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'max-age=3600' // Cache for 1 hour
        }
      });
    }
    
    // For all other routes, return 404 with more info
    return new Response(`Route not found in mono-jsx app: ${url.pathname}`, { status: 404 });
  },
};