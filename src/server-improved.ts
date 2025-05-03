import type { Post, TagInfo, Result } from "./types.ts";
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
import { logger, formatDate } from "./utils.ts";

// Types for our router
type RouteHandler = (context: RequestContext) => Promise<Response>;
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type Route = {
  method: HttpMethod;
  pattern: RegExp | string;
  handler: RouteHandler;
};

// Unified request context passed to all handlers
interface RequestContext {
  readonly request: Request;
  readonly url: URL;
  readonly path: string;
  readonly config: Config;
  readonly renderConfig: {
    readonly baseUrl: string;
    readonly description: string;
  };
  readonly isHtmxRequest: boolean;
  readonly posts: Post[];
}

/**
 * Core server functionality for handling HTTP requests
 */
export const createServer = (config: Config) => {
  // Cache definitions
  const CACHES = {
    posts: createCache<Post[]>(60 * 1000), // 1 minute TTL
    static: new Map<string, { data: Uint8Array; contentType: string }>(),
  };

  // Create router instance
  const router = createRouter();

  // Define route handlers
  router.get("/", handleHome);
  router.get("/posts/", handlePostDetail);
  router.get("/tags$", handleTagIndex);
  router.get("/tags/", handleTagPage);
  router.get("/about", handleAbout);
  router.get("/search", handleSearch);
  router.get("/feed.xml", handleRssFeed);
  router.get(/^\/(css|js|fonts)\//, handleStaticFile);
  router.post("/api/posts", handleCreatePost);

  // Define main request handler
  const handleRequest = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Log incoming requests for debugging
    logger.info(`${request.method} ${path}`);
    
    // Handle preflight OPTIONS requests for CORS
    if (request.method === "OPTIONS" && path.startsWith("/api/")) {
      logger.info("Handling CORS preflight request");
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    
    const renderConfig = {
      baseUrl: config.server.publicUrl,
      description: config.blog.description,
    };
    
    const isHtmxRequest = request.headers.get("HX-Request") === "true";

    try {
      // Load posts with caching
      const postsResult = await getPostsWithCache(CACHES.posts);
      
      if (!postsResult.ok) {
        return createErrorResponse(
          postsResult.error,
          path,
          config.blog.title,
          renderConfig,
          config.debug.showStackTraces,
          500
        );
      }

      // Create request context for handlers
      const context: RequestContext = {
        request,
        url,
        path,
        config,
        renderConfig,
        isHtmxRequest,
        posts: postsResult.value,
      };

      // Route the request
      return await router.route(context);
    } catch (error) {
      logger.error("Unhandled server error:", error);
      
      return createErrorResponse(
        error,
        path,
        config.blog.title,
        renderConfig,
        config.debug.showStackTraces,
        500
      );
    }
  };

  /**
   * Get posts with caching
   */
  const getPostsWithCache = async (
    cache: Cache<Post[]>
  ): Promise<Result<Post[], AppError>> => {
    const cachedPosts = cache.get();
    
    if (cachedPosts) {
      return { ok: true, value: cachedPosts };
    }
    
    const postsResult = await loadPosts();
    
    if (postsResult.ok) {
      cache.set(postsResult.value);
    }
    
    return postsResult;
  };

  /**
   * Handler for home page
   */
  async function handleHome(ctx: RequestContext): Promise<Response> {
    const { url, path, isHtmxRequest, posts, config } = ctx;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const { postsPerPage } = config.blog;
    
    const paginatedPosts = paginatePosts(posts, {
      page,
      itemsPerPage: postsPerPage,
    });
    
    const content = renderPostList(
      paginatedPosts.items,
      undefined,
      paginatedPosts.pagination
    );
    
    return createResponse(ctx, {
      title: config.blog.title,
      posts,
      path,
      content,
      status: 200,
      cacheMaxAge: 60, // 1 minute cache
    });
  }

  /**
   * Handler for post detail page
   */
  async function handlePostDetail(ctx: RequestContext): Promise<Response> {
    const { path, posts, config } = ctx;
    const slug = path.substring("/posts/".length);
    const post = posts.find((p) => p.slug === slug);
    
    if (!post) {
      return handleNotFound(ctx);
    }
    
    const content = renderPost(post);
    
    return createResponse(ctx, {
      title: `${config.blog.title} - ${post.title}`,
      post,
      path,
      content,
    });
  }

  /**
   * Handler for tag index page
   */
  async function handleTagIndex(ctx: RequestContext): Promise<Response> {
    const { path, posts, config } = ctx;
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
    
    return createResponse(ctx, {
      title: `${config.blog.title} - Tags`,
      tags,
      path,
      content,
    });
  }

  /**
   * Handler for tag page
   */
  async function handleTagPage(ctx: RequestContext): Promise<Response> {
    const { path, url, posts, config } = ctx;
    const tag = path.substring("/tags/".length);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const { postsPerPage } = config.blog;
    
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
    
    return createResponse(ctx, {
      title: `${config.blog.title} - Posts tagged "${tag}"`,
      posts: paginatedPosts.items,
      activeTag: tag,
      path,
      content,
    });
  }

  /**
   * Handler for about page
   */
  async function handleAbout(ctx: RequestContext): Promise<Response> {
    const { path, config } = ctx;
    const content = renderAbout();
    
    return createResponse(ctx, {
      title: config.blog.title,
      path,
      content,
    });
  }

  /**
   * Handler for search endpoint
   */
  async function handleSearch(ctx: RequestContext): Promise<Response> {
    const { url, posts } = ctx;
    const query = url.searchParams.get("q") || "";
    const results = searchPosts(posts, query);
    const content = renderSearchResults(results, query);
    
    return new Response(content, {
      headers: { "Content-Type": "text/html" },
    });
  }

  /**
   * Handler for RSS feed
   */
  async function handleRssFeed(ctx: RequestContext): Promise<Response> {
    const { posts, config } = ctx;
    const rssContent = generateRSS(posts, config.blog.title, config.server.publicUrl);
    
    return new Response(rssContent, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "max-age=300", // 5 minutes cache
      },
    });
  }
  
  /**
   * Handler for creating new posts
   */
  async function handleCreatePost(ctx: RequestContext): Promise<Response> {
    const { request, config } = ctx;
    
    logger.info("Handling create post request");
    
    // Validation: Check content type
    const contentType = request.headers.get("Content-Type");
    logger.info(`Content-Type: ${contentType}`);
    
    if (!contentType?.includes("application/json")) {
      logger.info("Invalid content type, expected application/json");
      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Parse request body
    let postData;
    try {
      const text = await request.text();
      logger.info(`Request body: ${text}`);
      postData = JSON.parse(text);
    } catch (error) {
      logger.error("Failed to parse JSON:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Validate required fields
    const { title, content, tags } = postData;
    logger.info(`Title: ${title}, Content length: ${content?.length || 0}, Tags: ${JSON.stringify(tags)}`);
    
    if (!title || !content) {
      logger.info("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Title and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Generate slug from title
    const slug = title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    
    logger.info(`Generated slug: ${slug}`);
    
    // Create post content with frontmatter
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tagsList = Array.isArray(tags) ? tags : [];
    
    const frontmatter = [
      '---',
      `title: ${title}`,
      `date: ${date}`,
      `slug: ${slug}`,
      tagsList.length > 0 ? `tags:\n${tagsList.map(tag => `  - ${tag}`).join('\n')}` : '',
      '---',
      '',
      content
    ].join('\n');
    
    // Write to file
    const filePath = `${config.blog.postsDir}/${slug}.md`;
    logger.info(`Writing post to: ${filePath}`);
    
    try {
      await Deno.writeTextFile(filePath, frontmatter);
      logger.info("Post written successfully");
      
      // Invalidate post cache to include the new post
      CACHES.posts.invalidate();
      logger.info("Post cache invalidated");
      
      const response = {
        success: true,
        slug,
        path: `/posts/${slug}`
      };
      
      logger.info(`Returning response: ${JSON.stringify(response)}`);
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 201, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"  // Allow CORS for testing
          } 
        }
      );
    } catch (error) {
      logger.error("Failed to create post:", error);
      
      return new Response(
        JSON.stringify({ error: "Failed to create post", details: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * Handler for static files
   */
  async function handleStaticFile(ctx: RequestContext): Promise<Response> {
    const { path } = ctx;
    const filePath = `./public${path}`;
    
    // Check cache first
    if (CACHES.static.has(filePath)) {
      const cached = CACHES.static.get(filePath)!;
      return createStaticResponse(cached.data, cached.contentType, filePath);
    }
    
    const fileResult = await tryCatch<Uint8Array, AppError>(
      async () => await Deno.readFile(filePath),
      (error) => createError("NotFound", `File not found: ${filePath}`, error),
    );
    
    return resultToResponse(fileResult, {
      onSuccess: (file) => {
        const contentType = getContentType(filePath);
        
        // Cache smaller files (< 1MB)
        if (file.length < 1024 * 1024) {
          CACHES.static.set(filePath, { data: file, contentType });
        }
        
        return createStaticResponse(file, contentType, filePath);
      },
      onError: () => new Response("Not Found", { status: 404 }),
    });
  }

  /**
   * Handler for 404 not found
   */
  async function handleNotFound(ctx: RequestContext): Promise<Response> {
    const { path, config } = ctx;
    const content = renderNotFound();
    
    return createResponse(ctx, {
      title: config.blog.title,
      path,
      content,
      status: 404,
    });
  }

  /**
   * Create static file response with appropriate headers
   */
  const createStaticResponse = (
    file: Uint8Array,
    contentType: string,
    filePath: string,
  ): Response => {
    const headers = new Headers({ "Content-Type": contentType });
    
    // Set caching headers based on file type
    if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
      headers.set("Cache-Control", "public, max-age=604800"); // 1 week
    } else if (filePath.includes("/fonts/")) {
      headers.set("Cache-Control", "public, max-age=2592000, immutable"); // 1 month
    } else if (
      filePath.endsWith(".svg") || filePath.endsWith(".png") ||
      filePath.endsWith(".jpg") || filePath.endsWith(".gif")
    ) {
      headers.set("Cache-Control", "public, max-age=1209600"); // 2 weeks
    } else {
      headers.set("Cache-Control", "public, max-age=86400"); // 1 day
    }
    
    headers.set("Vary", "Accept-Encoding");
    
    return new Response(file, { headers });
  };

  /**
   * Get content type based on file extension
   */
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

  /**
   * Create a standardized response with complete or partial HTML
   */
  const createResponse = (
    ctx: RequestContext,
    options: {
      title: string;
      path: string;
      content: string;
      posts?: Post[];
      post?: Post;
      tags?: TagInfo[];
      activeTag?: string;
      status?: number;
      cacheMaxAge?: number;
    },
  ): Response => {
    const { isHtmxRequest, renderConfig } = ctx;
    const { 
      title, 
      path, 
      content, 
      posts, 
      post, 
      tags, 
      activeTag,
      status = 200,
      cacheMaxAge,
    } = options;
    
    // For HTMX requests, return just the content
    if (isHtmxRequest) {
      return new Response(content, {
        headers: {
          "Content-Type": "text/html",
          "HX-Push-Url": path,
          "HX-Trigger": JSON.stringify({
            scrollToTop: {
              scroll: "top",
              offset: 120,
            },
          }),
        },
      });
    }
    
    // For full page requests, render complete document
    const headers = new Headers({ "Content-Type": "text/html" });
    
    if (cacheMaxAge) {
      headers.set("Cache-Control", `max-age=${cacheMaxAge}`);
    }
    
    return new Response(
      renderDocument(
        { title, posts, post, tags, activeTag, path },
        content,
        renderConfig,
      ),
      { status, headers },
    );
  };

  /**
   * Create standardized error response
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

  // Return the server interface
  return {
    handleRequest,
  };
};

/**
 * Start the HTTP server
 */
export const startServer = (port: number, config: Config): void => {
  logger.info(`Starting server on port ${port}...`);
  
  const server = createServer(config);
  
  Deno.serve({
    port,
    onListen: ({ hostname, port }) => {
      logger.info(`Server running at http://${hostname}:${port}/`);
    },
  }, (request) => server.handleRequest(request));
};

/**
 * Simple cache with TTL
 */
interface Cache<T> {
  get: () => T | null;
  set: (value: T) => void;
  invalidate: () => void;
}

const createCache = <T>(ttl: number): Cache<T> => {
  let data: T | null = null;
  let timestamp = 0;
  
  return {
    get: () => {
      const now = Date.now();
      if (data && (now - timestamp) < ttl) {
        return data;
      }
      return null;
    },
    set: (value: T) => {
      data = value;
      timestamp = Date.now();
    },
    invalidate: () => {
      data = null;
      timestamp = 0;
    },
  };
};

/**
 * Router implementation for matching routes and executing handlers
 */
const createRouter = () => {
  const routes: Route[] = [];
  
  const addRoute = (method: HttpMethod, pattern: RegExp | string, handler: RouteHandler) => {
    routes.push({ method, pattern, handler });
    logger.info(`Route registered: ${method} ${pattern.toString()}`);
  };
  
  const get = (pattern: RegExp | string, handler: RouteHandler) => 
    addRoute("GET", pattern, handler);
    
  const post = (pattern: RegExp | string, handler: RouteHandler) => 
    addRoute("POST", pattern, handler);
  
  const route = async (ctx: RequestContext): Promise<Response> => {
    const { request, path } = ctx;
    const method = request.method as HttpMethod;
    
    logger.info(`Request received: ${method} ${path}`);
    
    // Direct route handling for POST /api/posts - bypass regular routing
    if (method === "POST" && path === "/api/posts") {
      logger.info("Special case: Handling POST to /api/posts directly");
      const postHandler = routes.find(r => 
        r.method === "POST" && 
        (r.pattern === "/api/posts" || 
         (r.pattern instanceof RegExp && r.pattern.test("/api/posts")))
      )?.handler;
      
      if (postHandler) {
        return await postHandler(ctx);
      }
    }
    
    // Log all registered routes for debugging
    logger.info(`Available routes: ${routes.map(r => 
      `${r.method} ${typeof r.pattern === 'string' ? r.pattern : '(RegExp)'}`).join(', ')}`);
    
    // Find matching route
    for (const route of routes) {
      logger.info(`Checking route: ${route.method} ${route.pattern.toString()}`);
      
      // Skip if method doesn't match
      if (route.method !== method) {
        logger.info(`Method mismatch: ${route.method} != ${method}`);
        continue;
      }
      
      let matches = false;
      
      if (route.pattern instanceof RegExp) {
        matches = route.pattern.test(path);
        logger.info(`RegExp pattern ${route.pattern.toString()} match: ${matches}`);
      } else if (typeof route.pattern === "string") {
        if (route.pattern.endsWith("/")) {
          matches = path.startsWith(route.pattern);
          logger.info(`String pattern with slash ${route.pattern} match: ${matches}`);
        } else {
          matches = path === route.pattern;
          logger.info(`String pattern exact ${route.pattern} match: ${matches}`);
        }
      }
      
      if (matches) {
        logger.info(`Route matched: ${method} ${path} -> ${route.pattern.toString()}`);
        return await route.handler(ctx);
      }
    }
    
    logger.info(`No matching route found for ${method} ${path}`);
    
    // If no route matches, return 404
    const notFoundHandler = routes.find(
      (r) => r.method === "GET" && r.pattern === "/not-found"
    )?.handler;
    
    if (notFoundHandler) {
      return await notFoundHandler(ctx);
    }
    
    // Fallback 404 if no explicit handler
    const content = renderNotFound();
    return new Response(
      renderDocument(
        { title: ctx.config.blog.title, path },
        content,
        ctx.renderConfig,
      ),
      { status: 404, headers: { "Content-Type": "text/html" } },
    );
  };
  
  return {
    get,
    post,
    route,
    routes, // Expose routes for inspection/debugging
  };
};