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
 * Handle HTTP requests
 */
const handleRequest = (
  request: Request,
  config: Config
): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Rendering configuration
  const renderConfig = {
    baseUrl: config.server.publicUrl,
    description: config.blog.description,
  };

  return handleRequestSafe(request, url, path, config).catch((error) => {
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

/**
 * Handle request with proper error boundaries
 */
const handleRequestSafe = async (
  request: Request,
  url: URL,
  path: string,
  config: Config
): Promise<Response> => {
  // Rendering configuration
  const renderConfig = {
    baseUrl: config.server.publicUrl,
    description: config.blog.description,
  };

  // Serve static files
  if (path.startsWith("/css/") || path.startsWith("/js/")) {
    return await serveStaticFile(`./public${path}`);
  }

  // Load all posts for navigation and listing
  const postsResult = await loadPosts();

  // Handle posts loading error
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

  // Handle HTMX requests differently (for partial content)
  const isHtmxRequest = request.headers.get("HX-Request") === "true";

  // Route the request
  return routeRequest(request, url, path, posts, config, isHtmxRequest);
};

/**
 * Route the request to the appropriate handler
 */
const routeRequest = async (
  request: Request,
  url: URL,
  path: string,
  posts: Post[],
  config: Config,
  isHtmxRequest: boolean
): Promise<Response> => {
  const { blog: { title: blogTitle, description: blogDescription }, server: { publicUrl } } = config;

  // Rendering configuration
  const renderConfig = {
    baseUrl: publicUrl,
    description: blogDescription,
  };

  // Home page - list all posts
  if (path === "/") {
    // Get pagination parameters
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const { postsPerPage } = config.blog;

    // Paginate posts
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
      return new Response(content, {
        headers: { "Content-Type": "text/html" }
      });
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
      return new Response(content, {
        headers: { "Content-Type": "text/html" }
      });
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
    // Build tag metadata
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
      return new Response(
        renderDocument({ title: blogTitle, post, path }, content, renderConfig),
        { headers: { "Content-Type": "text/html" } }
      );
    }
  }

  // About page
  if (path === "/about") {
    const content = renderAbout();
    return new Response(
      renderDocument({ title: blogTitle, posts, path }, content, renderConfig),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 404 page
  const content = renderNotFound();
  return new Response(
    renderDocument({ title: blogTitle, path }, content, renderConfig),
    { status: 404, headers: { "Content-Type": "text/html" } }
  );
};

/**
 * Serve a static file
 */
const serveStaticFile = async (filePath: string): Promise<Response> => {
  const fileResult = await tryCatch<Uint8Array, AppError>(
    async () => await Deno.readFile(filePath),
    (error) => createError("NotFound", `File not found: ${filePath}`, error)
  );

  return resultToResponse(fileResult, {
    onSuccess: (file) => {
      const contentType = getContentType(filePath);
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    },
    onError: () => new Response("Not Found", { status: 404 }),
  });
};

/**
 * Get the content type based on file extension
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
 * Start the HTTP server
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

// Import types
import type { Post, TagInfo } from "./types.ts";