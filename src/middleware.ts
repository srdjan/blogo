import { logger } from "./utils.ts";

/**
 * Middleware for logging requests
 */
export const loggerMiddleware = async (ctx: any, next: () => Promise<void>) => {
  const start = performance.now();
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  logger.info(`${ctx.request.method} ${path}`);

  try {
    await next();
  } catch (error) {
    logger.error("Unhandled error:", error);
    throw error;
  } finally {
    const duration = performance.now() - start;
    logger.info(`Request processed in ${duration.toFixed(2)}ms`);
  }
};

/**
 * Middleware for debugging requests
 */
export const debugMiddleware = async (ctx: any, next: () => Promise<void>) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  logger.info(`Debug middleware: ${ctx.request.method} ${path}`);
  logger.info(`Request headers: ${JSON.stringify(Object.fromEntries(ctx.request.headers.entries()))}`);

  // Import common modules
  const render = await import("./render.tsx");
  const config = (await import("./config.ts")).CONFIG;

  if (path === "/") {
    logger.info("Home page request detected");

    // Load posts
    const { loadPosts } = await import("./parser.ts");
    const { paginatePosts } = await import("./pagination.ts");

    const postsResult = await loadPosts();

    if (!postsResult.ok) {
      logger.error("Failed to load posts");
      ctx.response = new Response(
        render.renderDocument(
          {
            title: config.blog.title,
            path: "/"
          },
          "<div>Error loading posts</div>",
          {
            baseUrl: config.server.publicUrl,
            description: config.blog.description,
          }
        ),
        {
          status: 500,
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
      return;
    }

    const posts = postsResult.value;
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const { postsPerPage } = config.blog;

    const paginatedPosts = paginatePosts(posts, {
      page,
      itemsPerPage: postsPerPage,
    });

    // Manually handle home page
    ctx.response = new Response(
      render.renderDocument(
        {
          title: config.blog.title,
          posts,
          path: "/"
        },
        render.renderPostList(
          paginatedPosts.items,
          undefined,
          paginatedPosts.pagination
        ),
        {
          baseUrl: config.server.publicUrl,
          description: config.blog.description,
        }
      ),
      {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "max-age=60" // 1 minute cache
        }
      }
    );

    logger.info(`Home page response set manually with ${posts.length} posts`);
    return;
  }

  // Handle post detail pages
  if (path.startsWith("/posts/")) {
    logger.info("Post detail page request detected");
    const slug = path.substring("/posts/".length);

    // Load posts
    const { loadPosts } = await import("./parser.ts");

    const postsResult = await loadPosts();

    if (!postsResult.ok) {
      logger.error("Failed to load posts");
      ctx.response = new Response(
        render.renderDocument(
          {
            title: config.blog.title,
            path
          },
          "<div>Error loading posts</div>",
          {
            baseUrl: config.server.publicUrl,
            description: config.blog.description,
          }
        ),
        {
          status: 500,
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
      return;
    }

    const posts = postsResult.value;
    const post = posts.find((p) => p.slug === slug);

    if (!post) {
      // Post not found, render 404
      ctx.response = new Response(
        render.renderDocument(
          {
            title: `${config.blog.title} - Not Found`,
            path
          },
          render.renderNotFound(),
          {
            baseUrl: config.server.publicUrl,
            description: config.blog.description,
          }
        ),
        {
          status: 404,
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
      logger.info(`Post not found for slug: ${slug}`);
      return;
    }

    // Manually handle post detail page
    ctx.response = new Response(
      render.renderDocument(
        {
          title: `${config.blog.title} - ${post.title}`,
          post,
          path
        },
        render.renderPost(post),
        {
          baseUrl: config.server.publicUrl,
          description: post.excerpt || config.blog.description,
        }
      ),
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    );

    logger.info(`Post detail page response set manually for slug: ${slug}`);
    return;
  }

  // Handle tag detail pages
  if (path.startsWith("/tags/") && path !== "/tags") {
    logger.info("Tag detail page request detected");
    const tag = path.substring("/tags/".length);

    // Load posts
    const { loadPosts } = await import("./parser.ts");
    const { paginatePosts } = await import("./pagination.ts");

    const postsResult = await loadPosts();

    if (!postsResult.ok) {
      logger.error("Failed to load posts for tag page");
      ctx.response = new Response(
        render.renderDocument(
          {
            title: config.blog.title,
            path
          },
          "<div>Error loading posts</div>",
          {
            baseUrl: config.server.publicUrl,
            description: config.blog.description,
          }
        ),
        {
          status: 500,
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
      return;
    }

    const posts = postsResult.value;
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const { postsPerPage } = config.blog;

    // Filter posts by tag and paginate
    const paginatedPosts = paginatePosts(posts, {
      page,
      itemsPerPage: postsPerPage,
      tag,
    });

    // Manually handle tag detail page
    ctx.response = new Response(
      render.renderDocument(
        {
          title: `${config.blog.title} - Posts tagged "${tag}"`,
          posts: paginatedPosts.items,
          activeTag: tag,
          path
        },
        render.renderPostList(
          paginatedPosts.items,
          tag,
          paginatedPosts.pagination
        ),
        {
          baseUrl: config.server.publicUrl,
          description: config.blog.description,
        }
      ),
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    );

    logger.info(`Tag detail page response set manually for tag: ${tag} with ${paginatedPosts.items.length} posts`);
    return;
  }

  // Handle about page
  if (path === "/about") {
    logger.info("About page request detected");

    // Manually handle about page
    ctx.response = new Response(
      render.renderDocument(
        {
          title: `${config.blog.title} - About`,
          path
        },
        render.renderAbout(),
        {
          baseUrl: config.server.publicUrl,
          description: config.blog.description,
        }
      ),
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    );

    logger.info("About page response set manually");
    return;
  }

  // Handle tags page
  if (path === "/tags") {
    logger.info("Tags page request detected");

    // Load posts
    const { loadPosts } = await import("./parser.ts");

    const postsResult = await loadPosts();

    if (!postsResult.ok) {
      logger.error("Failed to load posts");
      ctx.response = new Response(
        render.renderDocument(
          {
            title: config.blog.title,
            path
          },
          "<div>Error loading tags</div>",
          {
            baseUrl: config.server.publicUrl,
            description: config.blog.description,
          }
        ),
        {
          status: 500,
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
      return;
    }

    const posts = postsResult.value;
    const tagMap = new Map<string, { name: string; count: number; posts: typeof posts }>();

    posts.forEach((post) => {
      post.tags?.forEach((tag) => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { name: tag, count: 0, posts: [] });
        }

        const tagInfo = tagMap.get(tag)!;
        tagInfo.count += 1;
        tagInfo.posts.push(post);
      });
    });

    const tags = Array.from(tagMap.values());

    // Manually handle tags page
    ctx.response = new Response(
      render.renderDocument(
        {
          title: `${config.blog.title} - Tags`,
          tags,
          path
        },
        render.renderTagIndex(tags),
        {
          baseUrl: config.server.publicUrl,
          description: config.blog.description,
        }
      ),
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    );

    logger.info(`Tags page response set manually with ${tags.length} tags`);
    return;
  }

  // Handle search page
  if (path === "/search") {
    logger.info("Search page request detected");
    const query = url.searchParams.get("q") || "";

    // Load posts and search
    const { loadPosts } = await import("./parser.ts");
    const { searchPosts } = await import("./search.ts");

    const postsResult = await loadPosts();

    if (!postsResult.ok) {
      logger.error("Failed to load posts for search");
      ctx.response = new Response(
        render.renderSearchResults([], query),
        {
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
      return;
    }

    const posts = postsResult.value;
    const results = searchPosts(posts, query);

    // Manually handle search page
    ctx.response = new Response(
      render.renderSearchResults(results, query),
      {
        headers: {
          "Content-Type": "text/html"
        }
      }
    );

    logger.info(`Search page response set manually for query: "${query}" with ${results.length} results`);
    return;
  }

  // Handle RSS feed
  if (path === "/feed.xml") {
    logger.info("RSS feed request detected");

    // Load posts
    const { loadPosts } = await import("./parser.ts");
    const { generateRSS } = await import("./rss.ts");

    const postsResult = await loadPosts();

    if (!postsResult.ok) {
      logger.error("Failed to load posts for RSS feed");
      ctx.response = new Response(
        generateRSS([], config.blog.title, config.server.publicUrl),
        {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "max-age=300" // 5 minutes cache
          }
        }
      );
      return;
    }

    const posts = postsResult.value;

    // Manually handle RSS feed
    ctx.response = new Response(
      generateRSS(posts, config.blog.title, config.server.publicUrl),
      {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "max-age=300" // 5 minutes cache
        }
      }
    );

    logger.info(`RSS feed response set manually with ${posts.length} posts`);
    return;
  }

  await next();
};

/**
 * Middleware for handling CORS
 */
export const corsMiddleware = async (ctx: any, next: () => Promise<void>) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  // Handle preflight OPTIONS requests for CORS
  if (ctx.request.method === "OPTIONS" && path.startsWith("/api/")) {
    logger.info("Handling CORS preflight request");
    ctx.response = new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
    return;
  }

  await next();
};
