import type { Post, TagInfo } from "./types.ts";
import { loadPosts } from "./parser.ts";
import {
  renderAbout,
  renderDocument,
  renderErrorPage,
  renderNotFound,
  renderPost,
  renderPostList,
  renderSearchResults,
  renderTagIndex,
} from "./render.ts";
import { generateRSS } from "./rss.ts";
import { searchPosts } from "./search.ts";
import { createError, resultToResponse, tryCatch } from "./error.ts";
import type { AppError } from "./error.ts";
import type { Config } from "./config.ts";
import { paginatePosts } from "./pagination.ts";
import { logger } from "./utils.ts";

/**
 * Handle HTTP requests with pure functional approach
 */
const handleRequest = (
  request: Request,
  config: Config,
): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Rendering configuration for consistency
  const renderConfig = {
    baseUrl: config.server.publicUrl,
    description: config.blog.description,
  };

  return handleRequestSafe(request, url, path, config, renderConfig).catch(
    (error) => {
      logger.error("Unhandled server error:", error);

      // Create unified error response
      return createErrorResponse(
        error,
        path,
        config.blog.title,
        renderConfig,
        config.debug.showStackTraces,
        500,
      );
    },
  );
};

/**
 * Create a standardized error response
 */
const createErrorResponse = (
  error: unknown,
  path: string,
  blogTitle: string,
  renderConfig: { baseUrl: string; description: string },
  showStackTraces: boolean,
  status = 500,
): Response => {
  const errorContent = renderErrorPage({
    title: "Server Error",
    message: error instanceof Error ? error.message : String(error),
    stackTrace: showStackTraces
      ? (error instanceof Error ? error.stack : JSON.stringify(error, null, 2))
      : undefined,
  });

  return new Response(
    renderDocument(
      { title: `${blogTitle} - Error`, path },
      errorContent,
      renderConfig,
    ),
    { status, headers: { "Content-Type": "text/html" } },
  );
};

// Enhanced cache settings
const CACHE = {
  posts: {
    data: null as Post[] | null,
    timestamp: 0,
    ttl: 60 * 1000, // 1 minute TTL
  },
};

/**
 * Handle request with proper error boundaries using functional error handling
 */
const handleRequestSafe = async (
  request: Request,
  url: URL,
  path: string,
  config: Config,
  renderConfig: { baseUrl: string; description: string },
): Promise<Response> => {
  // Determine if this is an HTMX request for partial content
  const isHtmxRequest = request.headers.get("HX-Request") === "true";

  // Serve static files
  if (
    path.startsWith("/css/") || path.startsWith("/js/") ||
    path.startsWith("/fonts/")
  ) {
    return await serveStaticFile(`./public${path}`);
  }

  // Load all posts with enhanced caching
  const postsResult = await getPostsWithCache();

  // Handle posts loading error with functional pattern matching
  if (!postsResult.ok) {
    return createErrorResponse(
      postsResult.error,
      path,
      config.blog.title,
      renderConfig,
      config.debug.showStackTraces,
      500,
    );
  }

  const posts = postsResult.value;

  // Route the request
  return routeRequest(
    request,
    url,
    path,
    posts,
    config,
    renderConfig,
    isHtmxRequest,
  );
};

/**
 * Get posts with caching
 */
const getPostsWithCache = async (): Promise<Result<Post[], AppError>> => {
  const currentTime = Date.now();

  // Return from cache if valid
  if (
    CACHE.posts.data && (currentTime - CACHE.posts.timestamp) < CACHE.posts.ttl
  ) {
    return { ok: true, value: CACHE.posts.data };
  }

  // Cache miss or expired, load fresh data
  const postsResult = await loadPosts();

  // Update cache on success
  if (postsResult.ok) {
    CACHE.posts.data = postsResult.value;
    CACHE.posts.timestamp = currentTime;
  }

  return postsResult;
};

/**
 * Handle HTMX requests with proper headers for content swapping
 * This function maintains pure functional semantics while handling browser state
 */
const handleHtmxRequest = (
  path: string,
  content: string,
): Response => {
  return new Response(content, {
    headers: {
      "Content-Type": "text/html",
      "HX-Push-Url": path,
      "HX-Trigger": JSON.stringify({
        scrollToTop: {
          scroll: "top", // Explicit position
          offset: 120, // Account for header height
        },
      }),
    },
  });
};

/**
 * Route the request to the appropriate handler
 * Pure function mapping request details to response
 */
const routeRequest = (
  _request: Request,
  url: URL,
  path: string,
  posts: Post[],
  config: Config,
  renderConfig: { baseUrl: string; description: string },
  isHtmxRequest: boolean,
): Promise<Response> => {
  const { blog: { title: blogTitle } } = config;

  // Define route handlers in a map for cleaner routing
  const routes: Record<string, () => Promise<Response>> = {
    // Home page - list all posts
    "/": () => {
      return handlePostList(
        posts,
        url,
        path,
        blogTitle,
        config,
        renderConfig,
        isHtmxRequest,
      );
    },

    // RSS feed
    "/feed.xml": () => {
      const rssContent = generateRSS(posts, blogTitle, config.server.publicUrl);
      return Promise.resolve(
        new Response(rssContent, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "max-age=300", // 5 minutes cache
          },
        }),
      );
    },

    // Search endpoint
    "/search": () => {
      const query = url.searchParams.get("q") || "";
      const results = searchPosts(posts, query);
      const content = renderSearchResults(results, query);
      return Promise.resolve(
        new Response(content, {
          headers: { "Content-Type": "text/html" },
        }),
      );
    },

    // Tag index page
    "/tags": () => {
      return handleTagIndex(
        posts,
        path,
        blogTitle,
        renderConfig,
        isHtmxRequest,
      );
    },

    // About page
    "/about": () => {
      const content = renderAbout();
      if (isHtmxRequest) {
        return handleHtmxRequest(path, content);
      }
      return Promise.resolve(
        new Response(
          renderDocument(
            { title: blogTitle, posts, path },
            content,
            renderConfig,
          ),
          { headers: { "Content-Type": "text/html" } },
        ),
      );
    },
  };

  // Check for exact route match
  if (routes[path]) {
    return routes[path]();
  }

  // Handle pattern routes

  // Tag page
  if (path.startsWith("/tags/")) {
    return handleTagPage(
      posts,
      path,
      url,
      blogTitle,
      config,
      renderConfig,
      isHtmxRequest,
    );
  }

  // Single post page
  if (path.startsWith("/posts/")) {
    const slug = path.substring("/posts/".length);
    const post = posts.find((p) => p.slug === slug);

    if (post) {
      const content = renderPost(post);
      if (isHtmxRequest) {
        return handleHtmxRequest(path, content);
      }
      return new Response(
        renderDocument({ title: blogTitle, post, path }, content, renderConfig),
        { headers: { "Content-Type": "text/html" } },
      );
    }
  }

  // 404 page (fall-through for no matches)
  const content = renderNotFound();
  if (isHtmxRequest) {
    return handleHtmxRequest(path, content);
  }
  return new Response(
    renderDocument({ title: blogTitle, path }, content, renderConfig),
    { status: 404, headers: { "Content-Type": "text/html" } },
  );
};

/**
 * Handle the home page and post listings
 */
const handlePostList = (
  posts: Post[],
  url: URL,
  path: string,
  blogTitle: string,
  config: Config,
  renderConfig: { baseUrl: string; description: string },
  isHtmxRequest: boolean,
): Promise<Response> => {
  // Get pagination parameters
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const { postsPerPage } = config.blog;

  // Paginate posts with functional transformation
  const paginatedPosts = paginatePosts(posts, {
    page,
    itemsPerPage: postsPerPage,
  });

  const content = renderPostList(
    paginatedPosts.items,
    undefined,
    paginatedPosts.pagination,
  );

  // For HTMX requests, return just the content
  if (isHtmxRequest) {
    return handleHtmxRequest(path, content);
  }

  return new Response(
    renderDocument({ title: blogTitle, posts, path }, content, renderConfig),
    {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "max-age=60", // 1 minute cache
      },
    },
  );
};

/**
 * Handle tag page
 */
const handleTagPage = (
  posts: Post[],
  path: string,
  url: URL,
  blogTitle: string,
  config: Config,
  renderConfig: { baseUrl: string; description: string },
  isHtmxRequest: boolean,
): Promise<Response> => {
  const tag = path.substring("/tags/".length);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const { postsPerPage } = config.blog;

  // Paginate posts filtered by tag
  const paginatedPosts = paginatePosts(posts, {
    page,
    itemsPerPage: postsPerPage,
    tag,
  });

  const content = renderPostList(
    paginatedPosts.items,
    tag,
    paginatedPosts.pagination,
  );

  // For HTMX requests, return just the content
  if (isHtmxRequest) {
    return handleHtmxRequest(path, content);
  }

  return new Response(
    renderDocument(
      {
        title: `${blogTitle} - Posts tagged "${tag}"`,
        posts: paginatedPosts.items,
        activeTag: tag,
        path,
      },
      content,
      renderConfig,
    ),
    { headers: { "Content-Type": "text/html" } },
  );
};

/**
 * Handle tag index page
 */
const handleTagIndex = (
  posts: Post[],
  path: string,
  blogTitle: string,
  renderConfig: { baseUrl: string; description: string },
  isHtmxRequest: boolean,
): Promise<Response> => {
  // Build tag metadata using functional transformation
  const tagMap = new Map<string, TagInfo>();

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
  const content = renderTagIndex(tags);

  if (isHtmxRequest) {
    return handleHtmxRequest(path, content);
  }

  return new Response(
    renderDocument(
      { title: `${blogTitle} - Tags`, tags, path },
      content,
      renderConfig,
    ),
    { headers: { "Content-Type": "text/html" } },
  );
};

/**
 * Cache for static files to improve performance
 */
const staticCache = new Map<
  string,
  { data: Uint8Array; contentType: string }
>();

/**
 * Serve a static file with functional error handling and caching
 */
const serveStaticFile = async (filePath: string): Promise<Response> => {
  // Check cache first
  if (staticCache.has(filePath)) {
    const cached = staticCache.get(filePath)!;
    return createStaticResponse(cached.data, cached.contentType, filePath);
  }

  const fileResult = await tryCatch<Uint8Array, AppError>(
    async () => await Deno.readFile(filePath),
    (error) => createError("NotFound", `File not found: ${filePath}`, error),
  );

  return resultToResponse(fileResult, {
    onSuccess: (file) => {
      const contentType = getContentType(filePath);

      // Cache the file contents in memory for subsequent requests
      // Only cache smaller files (< 1MB) to avoid memory issues
      if (file.length < 1024 * 1024) {
        staticCache.set(filePath, { data: file, contentType });
      }

      return createStaticResponse(file, contentType, filePath);
    },
    onError: () => new Response("Not Found", { status: 404 }),
  });
};

/**
 * Create a static file response with appropriate caching headers
 */
const createStaticResponse = (
  file: Uint8Array,
  contentType: string,
  filePath: string,
): Response => {
  const headers = new Headers({ "Content-Type": contentType });

  // Set appropriate caching headers based on file type
  if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
    // Cache styles and scripts for 1 week
    headers.set("Cache-Control", "public, max-age=604800");
  } else if (filePath.includes("/fonts/")) {
    // Cache fonts for 1 month (virtually immutable)
    headers.set("Cache-Control", "public, max-age=2592000, immutable");
  } else if (
    filePath.endsWith(".svg") || filePath.endsWith(".png") ||
    filePath.endsWith(".jpg") || filePath.endsWith(".gif")
  ) {
    // Cache images for 2 weeks
    headers.set("Cache-Control", "public, max-age=1209600");
  } else {
    // Default cache for 1 day
    headers.set("Cache-Control", "public, max-age=86400");
  }

  // Add compression hint
  headers.set("Vary", "Accept-Encoding");

  return new Response(file, { headers });
};

const getContentType = (filePath: string): string => {
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (filePath.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
};

export const startServer = (port: number, config: Config): void => {
  logger.info(`Starting server on port ${port}...`);

  Deno.serve({
    port,
    onListen: ({ hostname, port }) => {
      logger.info(`Server running at http://${hostname}:${port}/`);
    },
  }, (request) => handleRequest(request, config));
};
