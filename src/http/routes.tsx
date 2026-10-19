import type { RouteHandler } from "./types.ts";
import {
  htmlResponse,
  isHtmxRequest,
  NOINDEX,
  pageView,
  PLAIN_CONTENT_TYPE,
  renderPageBody,
  RSS_CONTENT_TYPE,
  textView,
  toResponse,
  type View,
  type ViewHandler,
  XML_CONTENT_TYPE,
} from "./view.ts";
import type { ContentService } from "../domain/content.ts";
import type { HealthService } from "../domain/health.ts";
import type { AnalyticsService } from "../domain/analytics.ts";
import { renderLayout } from "../components/Layout.tsx";
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
import type { RouteContext } from "./types.ts";
import type { AppError } from "../lib/types.ts";
import type { SiteConfig } from "../domain/config.ts";
import type { AtProtoConfig } from "../config/atproto.ts";
import { slugToRkey } from "../atproto/mapping.ts";
import { type Cache, createInMemoryCache } from "../ports/cache.ts";
import { escapeHtml } from "../utils.ts";

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
  readonly atprotoVerification: RouteHandler;
  readonly clearHtmlCache: () => void;
};

const SITE_AUTHOR = "Srdjan Strbanovic";

const SEARCH_MODAL_TEXT_HEADERS = {
  "Content-Type": PLAIN_CONTENT_TYPE,
  "X-Robots-Tag": NOINDEX,
} as const;

const missingPostView = (
  error: AppError,
  notFoundBody: string,
  failureBody: string,
): View =>
  error.kind === "NotFound"
    ? textView(notFoundBody, 404)
    : textView(failureBody, 500);

export type RouteDependencies = {
  readonly contentService: ContentService;
  readonly healthService: HealthService;
  readonly analyticsService: AnalyticsService;
  readonly atConfig: AtProtoConfig | null;
  readonly site: SiteConfig;
  readonly isProd: boolean;
};

export const createRouteHandlers = (
  deps: RouteDependencies,
): RouteHandlers => {
  const {
    contentService,
    healthService,
    analyticsService,
    atConfig,
    site,
    isProd,
  } = deps;

  // HTML response cache: caches rendered HTML keyed by route path
  const htmlCache: Cache<string> = createInMemoryCache<string>();
  const htmlCacheTtlMs = isProd ? Infinity : 0;

  const clearHtmlCache = (): void => {
    htmlCache.clear();
  };

  const plain = (handler: ViewHandler): RouteHandler => async (ctx) =>
    toResponse(await handler(ctx), ctx, { site, isProd });

  const cachedRender = (handler: ViewHandler): RouteHandler => async (ctx) => {
    if (htmlCacheTtlMs === 0) {
      return toResponse(await handler(ctx), ctx, { site, isProd });
    }

    const prefix = isHtmxRequest(ctx.req) ? "htmx:" : "page:";
    const cacheKey = `${prefix}${ctx.pathname}`;

    const cached = htmlCache.get(cacheKey);
    if (cached.ok && cached.value.status === "hit") {
      return htmlResponse(cached.value.value, isProd, 200, {
        "X-Cache": "HIT",
      });
    }

    const view = await handler(ctx);

    // Only cache successful HTML pages
    if (view.kind === "page" && view.status === 200) {
      const body = renderPageBody(view.props, ctx, site);
      htmlCache.set(cacheKey, body, htmlCacheTtlMs);
      return htmlResponse(body, isProd, 200, { "X-Cache": "MISS" });
    }

    return toResponse(view, ctx, { site, isProd });
  };

  const home: ViewHandler = async (ctx) => {
    const postsResult = await contentService.loadPostsMetadataWithViews();

    return match(postsResult, {
      ok: (posts) =>
        pageView({
          title: "Blog - Home",
          description: "A minimal blog built with hsx",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <PostList posts={posts} />,
          author: SITE_AUTHOR,
        }),
      error: () =>
        pageView({
          title: "Error - Blog",
          description: "Failed to load posts",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load posts</div>,
        }, 500),
    });
  };

  const about: ViewHandler = (ctx) => {
    return pageView({
      title: "About - Blog",
      description: "About this blog and its features",
      path: createUrlPath(ctx.pathname),
      origin: ctx.url.origin,
      children: <About />,
    });
  };

  const tags: ViewHandler = async (ctx) => {
    const tagsResult = await contentService.getTags();

    return match(tagsResult, {
      ok: (tags) =>
        pageView({
          title: "Tags - Blog",
          description: "Browse posts by tags",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <TopicsIndex groups={groupTagsByTopic(tags)} />,
          author: SITE_AUTHOR,
        }),
      error: () =>
        pageView({
          title: "Error - Blog",
          description: "Failed to load tags",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load tags</div>,
        }, 500),
    });
  };

  const tagPosts: ViewHandler = async (ctx) => {
    const tagNameResult = createTagName(
      decodeURIComponent(ctx.pathname.replace("/tags/", "")),
    );

    if (!tagNameResult.ok) {
      return pageView({
        title: "Error - Blog",
        description: "Invalid tag name",
        path: createUrlPath(ctx.pathname),
        origin: ctx.url.origin,
        children: <div>Invalid tag name</div>,
      }, 400);
    }

    const tagName = tagNameResult.value;
    const postsResult = await contentService.getPostsByTag(tagName);

    return match(postsResult, {
      ok: (posts) =>
        pageView({
          title: `Posts tagged "${tagName}" - Blog`,
          description: `All posts tagged with ${tagName}`,
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <PostList posts={posts} activeTag={tagName} />,
          author: SITE_AUTHOR,
        }),
      error: () =>
        pageView({
          title: "Error - Blog",
          description: "Failed to load posts for tag",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load posts for tag</div>,
        }, 500),
    });
  };

  const post: ViewHandler = async (ctx) => {
    const slug = createSlug(ctx.pathname.replace("/posts/", ""));
    const postResult = await contentService.getPostBySlug(slug);

    if (!postResult.ok) {
      return missingPostView(
        postResult.error,
        "Post not found",
        "Failed to load post",
      );
    }

    const post = postResult.value;

    // Fire-and-forget: increment view count without blocking response
    // Use cached view count for display; increment happens in background
    analyticsService.incrementViewCount(slug).catch(() => {
      // Silently ignore analytics errors - not critical path
    });

    // Use existing view count from post (may lag by one view, acceptable for analytics)

    const atprotoDocUri = atConfig
      ? `at://${atConfig.did}/site.standard.document/${slugToRkey(slug)}`
      : undefined;

    return pageView({
      title: `${post.title} - Blog`,
      description: post.excerpt || `Read ${post.title}`,
      path: createUrlPath(ctx.pathname),
      origin: ctx.url.origin,
      children: <PostView post={post} />,
      type: "article",
      publishedTime: post.date,
      ...(post.modified && { modifiedTime: post.modified }),
      ...(post.tags && { tags: post.tags }),
      author: SITE_AUTHOR,
      ...(atprotoDocUri ? { atprotoDocUri } : {}),
    });
  };

  const search: ViewHandler = async (ctx) => {
    const query = ctx.searchParams.get("q");

    if (!query) {
      return pageView({
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
            <h1>Search</h1>
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
        author: SITE_AUTHOR,
      });
    }

    const postsResult = await contentService.searchPosts(query);

    return match(postsResult, {
      ok: (posts) =>
        pageView({
          title: `Search: "${query}" - Blog`,
          description: `Search results for ${query}`,
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          robots: "noindex, nofollow",
          canonicalPath: `${ctx.pathname}?${ctx.searchParams.toString()}`,
          children: <SearchResults posts={posts} query={query} />,
        }),
      error: () =>
        pageView({
          title: "Error - Blog",
          description: "Failed to search posts",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          robots: "noindex, nofollow",
          children: <div>Failed to search posts</div>,
        }, 500),
    });
  };

  const searchModal: ViewHandler = async (ctx) => {
    const query = ctx.searchParams.get("q");

    if (!query) {
      return {
        kind: "text",
        body: "Missing query parameter",
        status: 400,
        headers: SEARCH_MODAL_TEXT_HEADERS,
      };
    }

    const postsResult = await contentService.searchPosts(query);

    return match(postsResult, {
      ok: (posts): View => {
        if (posts.length === 0) {
          return {
            kind: "fragment",
            html: `<p>No posts found for "${escapeHtml(query)}".</p>`,
            headers: { "X-Robots-Tag": NOINDEX },
          };
        }

        const listItems = posts.map((post) =>
          `<li>
            <a href="/posts/${escapeHtml(post.slug)}"
               hx-get="/posts/${escapeHtml(post.slug)}"
               hx-target="#content-area"
               hx-swap="innerHTML"
               hx-push-url="true"
               class="search-result-link">
              ${escapeHtml(post.title)}
            </a>
          </li>`
        ).join("");

        const html =
          `<ul style="list-style: none; padding: 0; margin: 0;">${listItems}</ul>`;

        return {
          kind: "fragment",
          html,
          headers: { "X-Robots-Tag": NOINDEX },
        };
      },
      error: (): View => ({
        kind: "text",
        body: "Search failed",
        status: 500,
        headers: SEARCH_MODAL_TEXT_HEADERS,
      }),
    });
  };

  const rss: ViewHandler = async (ctx) => {
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

        return { kind: "xml", body: rssContent, contentType: RSS_CONTENT_TYPE };
      },
      error: () => textView("Failed to generate RSS", 500),
    });
  };

  // RSS subscription page
  const rssPage: ViewHandler = async (ctx) => {
    const postsResult = await contentService.loadPostsMetadata();
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
        return pageView({
          title: "RSS Subscriptions - Blog",
          description: "Subscribe to the full feed or topic-specific feeds",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <RSSSubscription baseUrl={baseUrl} topics={list} />,
        });
      },
      error: () =>
        pageView({
          title: "Error - Blog",
          description: "Failed to load RSS data",
          path: createUrlPath(ctx.pathname),
          origin: ctx.url.origin,
          children: <div>Failed to load RSS data</div>,
        }, 500),
    });
  };

  // Topic-specific RSS feed
  const rssByTopic: ViewHandler = async (ctx) => {
    const slug = ctx.pathname.replace("/rss/topic/", "");
    const topic = slugToTopic(slug);
    if (!topic) return textView("Topic not found", 404);

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
        return { kind: "xml", body: xml, contentType: RSS_CONTENT_TYPE };
      },
      error: () => textView("Failed to generate RSS", 500),
    });
  };

  const sitemap: ViewHandler = async (ctx) => {
    const postsResult = await contentService.loadPosts();
    return match(postsResult, {
      ok: (posts) => {
        const baseUrl = ctx.url.origin;
        const sitemapContent = generateSitemap(Array.from(posts), baseUrl);
        return {
          kind: "xml",
          body: sitemapContent,
          contentType: XML_CONTENT_TYPE,
        };
      },
      error: () => textView("Failed to generate sitemap", 500),
    });
  };

  const robots: ViewHandler = (ctx) => {
    const baseUrl = ctx.url.origin;
    const robotsContent = generateRobotsTxt(baseUrl);

    return {
      kind: "text",
      body: robotsContent,
      status: 200,
      headers: {
        "Content-Type": PLAIN_CONTENT_TYPE,
        "Cache-Control": "max-age=86400",
      },
    };
  };

  const ogImageDefault: ViewHandler = () => {
    return { kind: "svg", body: generateDefaultOGImage() };
  };

  const ogImagePost: ViewHandler = async (ctx) => {
    const slug = createSlug(
      ctx.pathname.replace("/images/og/", "").replace(".svg", ""),
    );
    const postResult = await contentService.getPostBySlug(slug);

    return match(postResult, {
      ok: (post): View => ({
        kind: "svg",
        body: generateOGImage(
          post.title,
          post.excerpt,
          post.tags?.map((tag) => tag as string),
        ),
      }),
      error: (error) =>
        missingPostView(error, "Not Found", "Failed to generate OG image"),
    });
  };

  const health: ViewHandler = async () => {
    const healthResult = await healthService.checkHealth();

    return match(healthResult, {
      ok: (health) => {
        const status = health.status === "unhealthy" ? 503 : 200;

        return { kind: "json", body: health, status };
      },
      error: (error): View => {
        const errorResponse = {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error.message,
        };

        return { kind: "json", body: errorResponse, status: 503 };
      },
    });
  };

  const atprotoVerification: ViewHandler = () => {
    if (!atConfig) {
      return textView("Not Found", 404);
    }

    const uri = `at://${atConfig.did}/site.standard.publication/self`;
    return {
      kind: "text",
      body: uri,
      status: 200,
      headers: {
        "Content-Type": PLAIN_CONTENT_TYPE,
        "Cache-Control": "max-age=3600",
      },
    };
  };

  return {
    home: cachedRender(home),
    about: cachedRender(about),
    tags: cachedRender(tags),
    tagPosts: cachedRender(tagPosts),
    post: cachedRender(post),
    search: plain(search),
    searchModal: plain(searchModal),
    rss: plain(rss),
    rssPage: cachedRender(rssPage),
    rssByTopic: plain(rssByTopic),
    sitemap: plain(sitemap),
    robots: plain(robots),
    ogImageDefault: plain(ogImageDefault),
    ogImagePost: plain(ogImagePost),
    health: plain(health),
    atprotoVerification: plain(atprotoVerification),
    clearHtmlCache,
  };
};
