import type { RouteHandler } from "./types.ts";
import type { ContentService } from "../domain/content.ts";
import type { HealthService } from "../domain/health.ts";
import { createLayout } from "../components/Layout.tsx";
import { PostList } from "../components/PostList.tsx";
import { PostView } from "../components/PostView.tsx";
import { TagIndex } from "../components/TagIndex.tsx";
import { SearchResults } from "../components/SearchResults.tsx";
import { About } from "../components/About.tsx";
import { createSlug, createTagName, createUrlPath } from "../lib/types.ts";
import { match } from "../lib/result.ts";

export type RouteHandlers = {
  readonly home: RouteHandler;
  readonly about: RouteHandler;
  readonly tags: RouteHandler;
  readonly tagPosts: RouteHandler;
  readonly post: RouteHandler;
  readonly search: RouteHandler;
  readonly searchModal: RouteHandler;
  readonly rss: RouteHandler;
  readonly sitemap: RouteHandler;
  readonly robots: RouteHandler;
  readonly ogImageDefault: RouteHandler;
  readonly ogImagePost: RouteHandler;
  readonly health: RouteHandler;
};

export const createRouteHandlers = (
  contentService: ContentService,
  healthService: HealthService,
): RouteHandlers => {
  const home: RouteHandler = async (ctx) => {
    const postsResult = await contentService.loadPosts();

    return match(postsResult, {
      ok: (posts) =>
        createLayout({
          title: "Blog - Home",
          description: "A minimal blog built with mono-jsx",
          path: createUrlPath(ctx.pathname),
          children: <PostList posts={posts} />,
          author: "Srdjan Strbanovic",
        }),
      error: () =>
        createLayout({
          title: "Error - Blog",
          description: "Failed to load posts",
          path: createUrlPath(ctx.pathname),
          children: <div>Failed to load posts</div>,
        }),
    });
  };

  const about: RouteHandler = (ctx) => {
    return createLayout({
      title: "About - Blog",
      description: "About this blog and its features",
      path: createUrlPath(ctx.pathname),
      children: <About />,
    });
  };

  const tags: RouteHandler = async (ctx) => {
    const tagsResult = await contentService.getTags();

    return match(tagsResult, {
      ok: (tags) =>
        createLayout({
          title: "Tags - Blog",
          description: "Browse posts by tags",
          path: createUrlPath(ctx.pathname),
          children: <TagIndex tags={tags} />,
          author: "Srdjan Strbanovic",
        }),
      error: () =>
        createLayout({
          title: "Error - Blog",
          description: "Failed to load tags",
          path: createUrlPath(ctx.pathname),
          children: <div>Failed to load tags</div>,
        }),
    });
  };

  const tagPosts: RouteHandler = async (ctx) => {
    const tagName = createTagName(
      decodeURIComponent(ctx.pathname.replace("/tags/", "")),
    );
    const postsResult = await contentService.getPostsByTag(tagName);

    return match(postsResult, {
      ok: (posts) =>
        createLayout({
          title: `Posts tagged "${tagName}" - Blog`,
          description: `All posts tagged with ${tagName}`,
          path: createUrlPath(ctx.pathname),
          children: <PostList posts={posts} activeTag={tagName} />,
          author: "Srdjan Strbanovic",
        }),
      error: () =>
        createLayout({
          title: "Error - Blog",
          description: "Failed to load posts for tag",
          path: createUrlPath(ctx.pathname),
          children: <div>Failed to load posts for tag</div>,
        }),
    });
  };

  const post: RouteHandler = async (ctx) => {
    const slug = createSlug(ctx.pathname.replace("/posts/", ""));
    const postResult = await contentService.getPostBySlug(slug);

    return match(postResult, {
      ok: (post) => {
        if (!post) {
          return new Response("Post not found", { status: 404 });
        }

        return createLayout({
          title: `${post.title} - Blog`,
          description: post.excerpt || `Read ${post.title}`,
          path: createUrlPath(ctx.pathname),
          children: <PostView post={post} />,
          type: "article",
          publishedTime: post.date,
          ...(post.modified && { modifiedTime: post.modified }),
          ...(post.tags && { tags: post.tags }),
          author: "Srdjan Strbanovic",
        });
      },
      error: () => new Response("Failed to load post", { status: 500 }),
    });
  };

  const search: RouteHandler = async (ctx) => {
    const query = ctx.searchParams.get("q");

    if (!query) {
      return createLayout({
        title: "Search - Blog",
        description: "Search blog posts",
        path: createUrlPath(ctx.pathname),
        children: (
          <main>
            <h1>Search</h1>
            <p>Please provide a search query.</p>
            <a href="/">← Back to home</a>
          </main>
        ),
        author: "Srdjan Strbanovic",
      });
    }

    const postsResult = await contentService.searchPosts(query);

    return match(postsResult, {
      ok: (posts) =>
        createLayout({
          title: `Search: "${query}" - Blog`,
          description: `Search results for ${query}`,
          path: createUrlPath(ctx.pathname),
          children: <SearchResults posts={posts} query={query} />,
        }),
      error: () =>
        createLayout({
          title: "Error - Blog",
          description: "Failed to search posts",
          path: createUrlPath(ctx.pathname),
          children: <div>Failed to search posts</div>,
        }),
    });
  };

  const searchModal: RouteHandler = async (ctx) => {
    const query = ctx.searchParams.get("q");

    if (!query) {
      return new Response("Missing query parameter", { status: 400 });
    }

    const postsResult = await contentService.searchPosts(query);

    return match(postsResult, {
      ok: (posts) => {
        if (posts.length === 0) {
          return new Response(`<p>No posts found for "${query}".</p>`, {
            headers: { "Content-Type": "text/html" },
          });
        }

        const listItems = posts.map((post) =>
          `<li>
            <a href="/posts/${post.slug}" 
               hx-get="/posts/${post.slug}" 
               hx-target="#content-area" 
               hx-swap="innerHTML" 
               hx-push-url="true" 
               class="search-result-link">
              ${post.title}
            </a>
          </li>`
        ).join("");

        const html =
          `<ul style="list-style: none; padding: 0; margin: 0;">${listItems}</ul>`;

        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      },
      error: () => new Response("Search failed", { status: 500 }),
    });
  };

  const rss: RouteHandler = async () => {
    const postsResult = await contentService.loadPosts();

    return match(postsResult, {
      ok: (posts) => {
        const baseUrl = "https://blogo.timok.deno.net";
        const rssContent = generateRSS(
          posts,
          "Blog",
          baseUrl,
          "A minimal blog built with mono-jsx",
        );

        return new Response(rssContent, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "max-age=3600",
          },
        });
      },
      error: () => new Response("Failed to generate RSS", { status: 500 }),
    });
  };

  const sitemap: RouteHandler = async () => {
    const postsResult = await contentService.loadPosts();

    return match(postsResult, {
      ok: (posts) => {
        const baseUrl = "https://blogo.timok.deno.net";
        const sitemapContent = generateSitemap(posts, baseUrl);

        return new Response(sitemapContent, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "max-age=3600",
          },
        });
      },
      error: () => new Response("Failed to generate sitemap", { status: 500 }),
    });
  };

  const robots: RouteHandler = () => {
    const baseUrl = "https://blogo.timok.deno.net";
    const robotsContent = generateRobotsTxt(baseUrl);

    return new Response(robotsContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "max-age=86400",
      },
    });
  };

  const ogImageDefault: RouteHandler = () => {
    const svgContent = generateDefaultOGImage();

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "max-age=3600",
      },
    });
  };

  const ogImagePost: RouteHandler = async (ctx) => {
    const slug = createSlug(
      ctx.pathname.replace("/images/og/", "").replace(".png", ""),
    );
    const postResult = await contentService.getPostBySlug(slug);

    return match(postResult, {
      ok: (post) => {
        if (!post) {
          const svgContent = generateDefaultOGImage();
          return new Response(svgContent, {
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "max-age=3600",
            },
          });
        }

        const svgContent = generateOGImage(post.title, post.excerpt, post.tags);

        return new Response(svgContent, {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "max-age=3600",
          },
        });
      },
      error: () => {
        const svgContent = generateDefaultOGImage();
        return new Response(svgContent, {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "max-age=3600",
          },
        });
      },
    });
  };

  const health: RouteHandler = async () => {
    const healthResult = await healthService.checkHealth();

    return match(healthResult, {
      ok: (health) => {
        const status = health.status === "healthy"
          ? 200
          : health.status === "degraded"
          ? 200
          : 503;

        return new Response(JSON.stringify(health, null, 2), {
          status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
      error: (error) => {
        const errorResponse = {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error.message,
        };

        return new Response(JSON.stringify(errorResponse, null, 2), {
          status: 503,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    });
  };

  return {
    home,
    about,
    tags,
    tagPosts,
    post,
    search,
    searchModal,
    rss,
    sitemap,
    robots,
    ogImageDefault,
    ogImagePost,
    health,
  };
};

// Helper functions (temporary - should be moved to dedicated modules)
function generateRSS(
  posts: readonly import("../lib/types.ts").Post[],
  title: string,
  baseUrl: string,
  description: string,
): string {
  // Simplified RSS generation - in real implementation, move to separate module
  const items = posts.slice(0, 20).map((post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${baseUrl}/posts/${post.slug}</link>
      <description>${escapeXml(post.excerpt || "")}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <guid>${baseUrl}/posts/${post.slug}</guid>
    </item>
  `).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

function generateSitemap(
  posts: readonly import("../lib/types.ts").Post[],
  baseUrl: string,
): string {
  const postUrls = posts.map((post) => `
  <url>
    <loc>${baseUrl}/posts/${post.slug}</loc>
    <lastmod>${post.modified || post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/tags</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  ${postUrls}
</urlset>`;
}

function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}

function generateDefaultOGImage(): string {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text x="600" y="315" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" fill="#ffffff">
      Blog
    </text>
  </svg>`;
}

function generateOGImage(
  title: string,
  excerpt?: string,
  _tags?: readonly string[],
): string {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text x="600" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#ffffff">
      ${escapeXml(title.length > 50 ? title.substring(0, 50) + "..." : title)}
    </text>
    ${
    excerpt
      ? `<text x="600" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#cccccc">
      ${
        escapeXml(
          excerpt.length > 80 ? excerpt.substring(0, 80) + "..." : excerpt,
        )
      }
    </text>`
      : ""
  }
  </svg>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
