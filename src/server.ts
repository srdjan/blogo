import type { Post, TagInfo } from "./types.ts";
import { loadPosts } from "./parser.ts";
import {
  renderDocument,
  renderPostList,
  renderPost,
  renderNotFound,
  renderAbout,
  renderTagIndex,
  renderSearchResults,
  renderErrorPage,
} from "./render.ts";
import { generateRSS } from "./rss.ts";
import { searchPosts } from "./search.ts";
import { resultToResponse, createError, tryCatch } from "./error.ts";
import type { AppError } from "./error.ts";
import type { Config } from "./config.ts";
import { paginatePosts } from "./pagination.ts";

/**
 * Handle HTTP requests with pure functional approach
 */
const handleRequest = (
  request: Request,
  config: Config
): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Rendering configuration for consistency
  const renderConfig = {
    baseUrl: config.server.publicUrl,
    description: config.blog.description,
  };

  return handleRequestSafe(request, url, path, config, renderConfig).catch((error) => {
    console.error("Unhandled server error:", error);

    const errorContent = renderErrorPage({
      title: "Server Error",
      message: error instanceof Error ? error.message : String(error),
      stackTrace: config.debug.showStackTraces
        ? (error instanceof Error ? error.stack : JSON.stringify(error, null, 2))
        : undefined
    });

    return new Response(
      renderDocument(
        { title: `${config.blog.title} - Error`, path },
        errorContent,
        renderConfig
      ),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  });
};

// Global cache for posts to avoid re-loading on every request
let postsCache: Post[] | null = null;
let postsCacheTime: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache TTL

/**
 * Handle request with proper error boundaries using functional error handling
 */
const handleRequestSafe = async (
  request: Request,
  url: URL,
  path: string,
  config: Config,
  renderConfig: { baseUrl: string; description: string }
): Promise<Response> => {
  // Determine if this is an HTMX request for partial content
  const isHtmxRequest = request.headers.get("HX-Request") === "true";

  // Serve static files
  if (path.startsWith("/css/") || path.startsWith("/js/")) {
    return await serveStaticFile(`./public${path}`);
  }

  // Load all posts with caching
  const currentTime = Date.now();
  let postsResult;
  if (postsCache && (currentTime - postsCacheTime) < CACHE_TTL) {
    postsResult = { ok: true, value: postsCache };
  } else {
    postsResult = await loadPosts();
    if (postsResult.ok) {
      postsCache = postsResult.value;
      postsCacheTime = currentTime;
    }
  }

  // Handle posts loading error with functional pattern matching
  if (!postsResult.ok) {
    const errorContent = renderErrorPage({
      title: "Error Loading Posts",
      message: postsResult.error.message,
      stackTrace: config.debug.showStackTraces
        ? JSON.stringify(postsResult.error, null, 2)
        : undefined
    });

    return new Response(
      renderDocument(
        { title: `${config.blog.title} - Error`, path },
        errorContent,
        renderConfig
      ),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  const posts = postsResult.value;

  // Route the request
  return routeRequest(request, url, path, posts, config, renderConfig, isHtmxRequest);
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
          offset: 120    // Account for header height
        }
      })
    }
  });
};

/**
 * Route the request to the appropriate handler
 * Pure function mapping request details to response
 */
const routeRequest = async (
  request: Request,
  url: URL,
  path: string,
  posts: Post[],
  config: Config,
  renderConfig: { baseUrl: string; description: string },
  isHtmxRequest: boolean
): Promise<Response> => {
  const { blog: { title: blogTitle } } = config;

  // Home page - list all posts
  if (path === "/") {
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
      paginatedPosts.pagination
    );

    // For HTMX requests, return just the content
    if (isHtmxRequest) {
      return handleHtmxRequest(path, content);
    }

    return new Response(
      renderDocument({ title: blogTitle, posts, path }, content, renderConfig),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // RSS feed
  if (path === "/feed.xml") {
    const rssContent = generateRSS(posts, blogTitle, config.server.publicUrl);

    return new Response(rssContent, {
      headers: { "Content-Type": "application/xml" }
    });
  }

  // Search endpoint
  if (path === "/search") {
    const query = url.searchParams.get("q") || "";
    const results = searchPosts(posts, query);
    const content = renderSearchResults(results, query);

    return new Response(content, {
      headers: { "Content-Type": "text/html" }
    });
  }

  // Tag page
  if (path.startsWith("/tags/")) {
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
      paginatedPosts.pagination
    );

    // For HTMX requests, return just the content
    if (isHtmxRequest) {
      return handleHtmxRequest(path, content);
    }

    return new Response(
      renderDocument({
        title: `${blogTitle} - Posts tagged "${tag}"`,
        posts: paginatedPosts.items,
        activeTag: tag,
        path
      }, content, renderConfig),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Tag index page
  if (path === "/tags") {
    // Build tag metadata using functional transformation
    const tagMap = new Map<string, TagInfo>();

    posts.forEach(post => {
      post.tags?.forEach(tag => {
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
      renderDocument({ title: `${blogTitle} - Tags`, tags, path }, content, renderConfig),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Single post page
  if (path.startsWith("/posts/")) {
    const slug = path.substring("/posts/".length);
    const post = posts.find(p => p.slug === slug);

    if (post) {
      const content = renderPost(post);

      if (isHtmxRequest) {
        return handleHtmxRequest(path, content);
      }

      return new Response(
        renderDocument({ title: blogTitle, post, path }, content, renderConfig),
        { headers: { "Content-Type": "text/html" } }
      );
    }
  }

  // About page
  if (path === "/about") {
    const content = renderAbout();

    if (isHtmxRequest) {
      return handleHtmxRequest(path, content);
    }

    return new Response(
      renderDocument({ title: blogTitle, posts, path }, content, renderConfig),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 404 page
  const content = renderNotFound();

  if (isHtmxRequest) {
    return handleHtmxRequest(path, content);
  }

  return new Response(
    renderDocument({ title: blogTitle, path }, content, renderConfig),
    { status: 404, headers: { "Content-Type": "text/html" } }
  );
};

/**
 * Serve a static file with functional error handling
 */
const serveStaticFile = async (filePath: string): Promise<Response> => {
  const fileResult = await tryCatch<Uint8Array, AppError>(
    async () => await Deno.readFile(filePath),
    (error) => createError("NotFound", `File not found: ${filePath}`, error)
  );

  return resultToResponse(fileResult, {
    onSuccess: (file) => {
      const contentType = getContentType(filePath);
      const headers = new Headers({ "Content-Type": contentType });
      
      // Add caching headers for static assets
      if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        // Cache for 1 week (in seconds)
        headers.set('Cache-Control', 'public, max-age=604800');
      } else if (filePath.includes('/fonts/')) {
        // Cache fonts for 1 month (in seconds)
        headers.set('Cache-Control', 'public, max-age=2592000');
      }
      
      return new Response(file, { headers });
    },
    onError: () => new Response("Not Found", { status: 404 }),
  });
};

/**
 * Get the content type based on file extension
 * Pure function mapping string to string
 */
const getContentType = (filePath: string): string => {
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
};

/**
 * Start the HTTP server with type-safe configuration
 */
export const startServer = async (port: number, config: Config): Promise<void> => {
  console.log(`Starting server on port ${port}...`);

  Deno.serve({
    port,
    onListen: ({ hostname, port }) => {
      console.log(`Server running at http://${hostname}:${port}/`);
    }
  }, (request) => handleRequest(request, config));
};

