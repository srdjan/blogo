import type { RouteHandler } from "./types.ts";
import type { ContentService } from "../domain/content.ts";
import type { HealthService } from "../domain/health.ts";
import type { AnalyticsService } from "../domain/analytics.ts";
import { createLayout } from "../components/Layout.tsx";
import { PostList } from "../components/PostList.tsx";
import { PostView } from "../components/PostView.tsx";
import { TopicsIndex } from "../components/TopicsIndex.tsx";
import { RSSSubscription } from "../components/RSSSubscription.tsx";
import {
  ALL_TOPICS,
  deriveTopicsFromTags,
  groupTagsByTopic,
  slugToTopic,
  topicToSlug,
} from "../config/topics.ts";
import { generateRSS, generateTopicRssFeed } from "../rss.ts";
import { SearchResults } from "../components/SearchResults.tsx";
import { About } from "../components/About.tsx";
import { createSlug, createTagName, createUrlPath } from "../lib/types.ts";
import { match } from "../lib/result.ts";
import { generateRobotsTxt, generateSitemap } from "../sitemap.ts";
import { generateDefaultOGImage, generateOGImage } from "../og-image.ts";
import { renderVNode } from "./render-vnode.ts";
import type { RouteContext } from "./types.ts";

export type RouteHandlers = {
  readonly home: RouteHandler;
  readonly about: RouteHandler;
  readonly tags: RouteHandler;
  readonly tagPosts: RouteHandler;
  readonly post: RouteHandler;
  readonly search: RouteHandler;
  readonly searchModal: RouteHandler;
  readonly rss: RouteHandler;
  readonly rssPage: RouteHandler;
  readonly rssByTopic: RouteHandler;
  readonly sitemap: RouteHandler;
  readonly robots: RouteHandler;
  readonly ogImageDefault: RouteHandler;
  readonly ogImagePost: RouteHandler;
  readonly health: RouteHandler;
};

export const createRouteHandlers = (
  contentService: ContentService,
  healthService: HealthService,
  analyticsService: AnalyticsService,
): RouteHandlers => {
  const isHtmxRequest = (req: Request): boolean =>
    req.headers.get("HX-Request") === "true";

  const renderFragment = (
    props: Parameters<typeof createLayout>[0],
  ): Response => {
    const fragmentHtml = renderVNode(props.children);
    return new Response(fragmentHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Vary": "HX-Request",
      },
    });
  };

  const renderPage = (
    ctx: RouteContext,
    props: Parameters<typeof createLayout>[0],
  ): Response => {
    return isHtmxRequest(ctx.req) ? renderFragment(props) : createLayout(props);
  };

  const home: RouteHandler = async (ctx) => {
    const postsResult = await contentService.loadPostsMetadataWithViews();

    return match(postsResult, {
      ok: (posts) =>
        renderPage(ctx, {
          title: "Blog - Home",
          description: "A minimal blog built with hsx",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <PostList posts={posts} />,
          author: "Srdjan Strbanovic",
        }),
      error: () =>
        renderPage(ctx, {
          title: "Error - Blog",
          description: "Failed to load posts",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load posts</div>,
        }),
    });
  };

  const about: RouteHandler = (ctx) => {
    return renderPage(ctx, {
      title: "About - Blog",
      description: "About this blog and its features",
      path: createUrlPath(ctx.pathname),
      origin: ctx.url.origin,
      children: <About />,
    });
  };

  const tags: RouteHandler = async (ctx) => {
    const tagsResult = await contentService.getTags();

    return match(tagsResult, {
      ok: (tags) =>
        renderPage(ctx, {
          title: "Tags - Blog",
          description: "Browse posts by tags",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <TopicsIndex groups={groupTagsByTopic(tags)} />,
          author: "Srdjan Strbanovic",
        }),
      error: () =>
        renderPage(ctx, {
          title: "Error - Blog",
          description: "Failed to load tags",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
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
        renderPage(ctx, {
          title: `Posts tagged "${tagName}" - Blog`,
          description: `All posts tagged with ${tagName}`,
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <PostList posts={posts} activeTag={tagName} />,
          author: "Srdjan Strbanovic",
        }),
      error: () =>
        renderPage(ctx, {
          title: "Error - Blog",
          description: "Failed to load posts for tag",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load posts for tag</div>,
        }),
    });
  };

  const post: RouteHandler = async (ctx) => {
    const slug = createSlug(ctx.pathname.replace("/posts/", ""));
    const postResult = await contentService.getPostBySlug(slug);

    if (!postResult.ok) {
      return new Response("Failed to load post", { status: 500 });
    }

    const post = postResult.value;

    if (!post) {
      return new Response("Post not found", { status: 404 });
    }

    // Increment view count
    const viewCountResult = await analyticsService.incrementViewCount(slug);
    const viewCount = viewCountResult.ok ? viewCountResult.value : undefined;

    // Add view count to post
    const postWithViews: typeof post = { ...post, viewCount };

    return renderPage(ctx, {
      title: `${post.title} - Blog`,
      description: post.excerpt || `Read ${post.title}`,
      path: createUrlPath(ctx.pathname),
      origin: ctx.url.origin,
      children: <PostView post={postWithViews} />,
      type: "article",
      publishedTime: post.date,
      ...(post.modified && { modifiedTime: post.modified }),
      ...(post.tags && { tags: post.tags }),
      author: "Srdjan Strbanovic",
    });
  };

  const search: RouteHandler = async (ctx) => {
    const query = ctx.searchParams.get("q");

    if (!query) {
      return renderPage(ctx, {
        title: "Search - Blog",
        description: "Search blog posts",
        path: createUrlPath(ctx.pathname),
        origin: ctx.url.origin,
        robots: "noindex, nofollow",
        canonicalPath: ctx.searchParams.toString()
          ? `${ctx.pathname}?${ctx.searchParams.toString()}`
          : ctx.pathname,
        children: (
          <section aria-label="Search">
            <h2>Search</h2>
            <p>Please provide a search query.</p>
            <a
              href="/"
              get="/"
              target="#content-area"
              swap="innerHTML"
              pushUrl="true"
            >
              &lArr; Back
            </a>
          </section>
        ),
        author: "Srdjan Strbanovic",
      });
    }

    const postsResult = await contentService.searchPosts(query);

    return match(postsResult, {
      ok: (posts) =>
        renderPage(ctx, {
          title: `Search: "${query}" - Blog`,
          description: `Search results for ${query}`,
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          robots: "noindex, nofollow",
          canonicalPath: `${ctx.pathname}?${ctx.searchParams.toString()}`,
          children: <SearchResults posts={posts} query={query} />,
        }),
      error: () =>
        renderPage(ctx, {
          title: "Error - Blog",
          description: "Failed to search posts",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          robots: "noindex, nofollow",
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

  const rss: RouteHandler = async (ctx) => {
    const postsResult = await contentService.loadPosts();

    return match(postsResult, {
      ok: (posts) => {
        const baseUrl = ctx.url.origin;
        const rssContent = generateRSS(
          Array.from(posts),
          "Blog",
          baseUrl,
          "A minimal blog built with hsx",
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

  // RSS subscription page
  const rssPage: RouteHandler = async (ctx) => {
    const postsResult = await contentService.loadPosts();
    return match(postsResult, {
      ok: (posts) => {
        const topicCounts = new Map<string, number>();
        for (const post of posts) {
          const topics = deriveTopicsFromTags(
            (post.tags as readonly string[]) ?? [],
          );
          for (const t of topics) {
            topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
          }
        }
        const baseUrl = ctx.url.origin;
        const list = ALL_TOPICS.map((topicName) => ({
          topic: topicName,
          feedPath: `/rss/topic/${topicToSlug(topicName)}`,
          count: topicCounts.get(topicName) ?? 0,
        }));
        return renderPage(ctx, {
          title: "RSS Subscriptions - Blog",
          description: "Subscribe to the full feed or topic-specific feeds",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <RSSSubscription baseUrl={baseUrl} topics={list} />,
        });
      },
      error: () =>
        renderPage(ctx, {
          title: "Error - Blog",
          description: "Failed to load RSS data",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load RSS data</div>,
        }),
    });
  };

  // Topic-specific RSS feed
  const rssByTopic: RouteHandler = async (ctx) => {
    const slug = ctx.pathname.replace("/rss/topic/", "");
    const topic = slugToTopic(slug);
    if (!topic) return new Response("Topic not found", { status: 404 });

    const postsResult = await contentService.loadPosts();
    return match(postsResult, {
      ok: (posts) => {
        const filtered = posts.filter((p) =>
          deriveTopicsFromTags((p.tags as readonly string[]) ?? []).includes(
            topic,
          )
        );
        const baseUrl = ctx.url.origin;
        const xml = generateTopicRssFeed(
          Array.from(filtered),
          String(topic),
          baseUrl,
          `/rss/topic/${slug}`,
        );
        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "max-age=3600",
          },
        });
      },
      error: () => new Response("Failed to generate RSS", { status: 500 }),
    });
  };

  const sitemap: RouteHandler = async (ctx) => {
    const postsResult = await contentService.loadPosts();
    return match(postsResult, {
      ok: (posts) => {
        const baseUrl = ctx.url.origin;
        const sitemapContent = generateSitemap(Array.from(posts), baseUrl);
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

  const robots: RouteHandler = (ctx) => {
    const baseUrl = ctx.url.origin;
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
      ctx.pathname.replace("/images/og/", "").replace(".svg", ""),
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

        const svgContent = generateOGImage(
          post.title,
          post.excerpt,
          post.tags?.map((tag) => tag as string),
        );

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
    rssPage,
    rssByTopic,
    sitemap,
    robots,
    ogImageDefault,
    ogImagePost,
    health,
  };
};
