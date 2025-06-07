import { App, type Context as MixonContext } from "@srdjan/mixon";
import type { Post, TagInfo } from "./types.ts";
import { loadPosts } from "./parser.ts";
import {
  renderAbout,
  renderDocument,
  renderNotFound,
  renderPost,
  renderPostList,
  renderSearchResults,
  renderTagIndex,
} from "./render.tsx";
import { generateRSS } from "./rss.ts";
import { searchPosts } from "./search.ts";
import type { Config } from "./config.ts";
import { paginatePosts } from "./pagination.ts";
import { logger } from "./utils.ts";

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

// Cache definitions
const CACHES = {
  posts: createCache<Post[]>(60 * 1000), // 1 minute TTL
  static: new Map<string, { data: Uint8Array; contentType: string }>(),
};
/**
 * Setup all blog routes using Mixon app instance
 */
export const setupBlogRoutes = (mixonApp: App, config: Config) => {
  // Extract Mixon utils for standardized response handling
  const { utils } = mixonApp;
  const { handleError, createResponse } = utils;

  // Define route handlers
  mixonApp.get("/", (ctx): void => {
    handleHome(ctx);
  });


  mixonApp.get("/posts/{slug}", handlePostDetail);
  mixonApp.get("/tags", handleTagIndex);
  mixonApp.get("/tags/{tag}", handleTagPage);
  mixonApp.get("/about", handleAbout);
  mixonApp.get("/search", handleSearch);
  mixonApp.get("/feed.xml", handleRssFeed);
  // Add specific routes for static files
  mixonApp.get("/css/{*}", handleStaticFile);
  mixonApp.get("/js/{*}", handleStaticFile);
  mixonApp.post("/api/posts", handleCreatePost);

  // Add a catch-all route for 404s
  mixonApp.get("/{*}", handleNotFound);

  /**
   * Handler for home page
   */
  async function handleHome(ctx: MixonContext): Promise<void> {
    logger.info("Handling home page request");

    const postsResult = await getPostsWithCache();

    if (!postsResult.ok) {
      logger.error("Failed to load posts");
      handleError(ctx, 500, "Failed to load posts", "Error loading posts");
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

    const content = renderPostList(
      paginatedPosts.items,
      undefined,
      paginatedPosts.pagination
    );

    const isHtmxRequest = ctx.request.headers.get("HX-Request") === "true";

    if (isHtmxRequest) {
      const headers = {
        "Content-Type": "text/html",
        "HX-Push-Url": "/",
        "HX-Trigger": JSON.stringify({
          scrollToTop: {
            scroll: "top",
            offset: 120,
          },
        }),
      };
      
      ctx.response = createResponse(ctx, content, { 
        status: 200,
        headers 
      });
      return;
    }

    const htmlContent = renderDocument(
      {
        title: config.blog.title,
        posts,
        path: "/"
      },
      content,
      {
        baseUrl: config.server.publicUrl,
        description: config.blog.description,
      }
    );
    
    const headers = {
      "Content-Type": "text/html",
      "Cache-Control": "max-age=60" // 1 minute cache
    };
    
    ctx.response = createResponse(ctx, htmlContent, { 
      status: 200,
      headers 
    });
  }

  /**
   * Handler for post detail page
   */
  async function handlePostDetail(ctx: MixonContext): Promise<void> {
    const postsResult = await getPostsWithCache();

    if (!postsResult.ok) {
      handleError(ctx, 500, "Failed to load posts", "Error loading posts");
      return;
    }

    if (!ctx.validated.params.ok) {
      handleError(ctx, 400, "Invalid post slug", ctx.validated.params.error);
      return;
    }

    const posts = postsResult.value;
    const slug = ctx.validated.params.value.slug;
    const post = posts.find((p) => p.slug === slug);

    if (!post) {
      return handleNotFound(ctx);
    }

    const content = renderPost(post);
    const path = `/posts/${slug}`;
    const isHtmxRequest = ctx.request.headers.get("HX-Request") === "true";

    if (isHtmxRequest) {
      const headers = {
        "Content-Type": "text/html",
        "HX-Push-Url": path,
        "HX-Trigger": JSON.stringify({
          scrollToTop: {
            scroll: "top",
            offset: 120,
          },
        }),
      };
      
      ctx.response = createResponse(ctx, content, { 
        status: 200,
        headers 
      });
      return;
    }

    const htmlContent = renderDocument(
      {
        title: `${config.blog.title} - ${post.title}`,
        post,
        path
      },
      content,
      {
        baseUrl: config.server.publicUrl,
        description: config.blog.description,
      }
    );
    
    ctx.response = createResponse(ctx, htmlContent, { 
      status: 200,
      headers: { "Content-Type": "text/html" } 
    });
  }

  /**
   * Handler for tag index page
   */
  async function handleTagIndex(ctx: MixonContext): Promise<void> {
    const postsResult = await getPostsWithCache();

    if (!postsResult.ok) {
      handleError(ctx, 500, "Failed to load posts", "Error loading posts");
      return;
    }

    const posts = postsResult.value;
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
    const path = "/tags";
    const isHtmxRequest = ctx.request.headers.get("HX-Request") === "true";

    if (isHtmxRequest) {
      const headers = {
        "Content-Type": "text/html",
        "HX-Push-Url": path,
        "HX-Trigger": JSON.stringify({
          scrollToTop: {
            scroll: "top",
            offset: 120,
          },
        }),
      };
      
      ctx.response = createResponse(ctx, content, { 
        status: 200,
        headers 
      });
      return;
    }

    const htmlContent = renderDocument(
      {
        title: `${config.blog.title} - Tags`,
        tags,
        path
      },
      content,
      {
        baseUrl: config.server.publicUrl,
        description: config.blog.description,
      }
    );
    
    ctx.response = createResponse(ctx, htmlContent, { 
      status: 200,
      headers: { "Content-Type": "text/html" } 
    });
  }

  /**
   * Handler for tag page
   */
  async function handleTagPage(ctx: MixonContext): Promise<void> {
    const postsResult = await getPostsWithCache();

    if (!postsResult.ok) {
      handleError(ctx, 500, "Failed to load posts", "Error loading posts");
      return;
    }

    if (!ctx.validated.params.ok) {
      handleError(ctx, 400, "Invalid tag parameter", ctx.validated.params.error);
      return;
    }

    const posts = postsResult.value;
    const tag = ctx.validated.params.value.tag;
    const url = new URL(ctx.request.url);
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

    const path = `/tags/${tag}`;
    const isHtmxRequest = ctx.request.headers.get("HX-Request") === "true";

    if (isHtmxRequest) {
      const headers = {
        "Content-Type": "text/html",
        "HX-Push-Url": path,
        "HX-Trigger": JSON.stringify({
          scrollToTop: {
            scroll: "top",
            offset: 120,
          },
        }),
      };
      
      ctx.response = createResponse(ctx, content, { 
        status: 200,
        headers 
      });
      return;
    }

    const htmlContent = renderDocument(
      {
        title: `${config.blog.title} - Posts tagged "${tag}"`,
        posts: paginatedPosts.items,
        activeTag: tag,
        path
      },
      content,
      {
        baseUrl: config.server.publicUrl,
        description: config.blog.description,
      }
    );
    
    ctx.response = createResponse(ctx, htmlContent, { 
      status: 200,
      headers: { "Content-Type": "text/html" } 
    });
  }

  /**
   * Handler for about page
   */
  async function handleAbout(ctx: MixonContext): Promise<void> {
    // Using await to make this an async function even though we don't need it
    await Promise.resolve();

    const content = renderAbout();
    const path = "/about";
    const isHtmxRequest = ctx.request.headers.get("HX-Request") === "true";

    if (isHtmxRequest) {
      const headers = {
        "Content-Type": "text/html",
        "HX-Push-Url": path,
        "HX-Trigger": JSON.stringify({
          scrollToTop: {
            scroll: "top",
            offset: 120,
          },
        }),
      };
      
      ctx.response = createResponse(ctx, content, { 
        status: 200,
        headers 
      });
      return;
    }

    const htmlContent = renderDocument(
      {
        title: config.blog.title,
        path
      },
      content,
      {
        baseUrl: config.server.publicUrl,
        description: config.blog.description,
      }
    );
    
    ctx.response = createResponse(ctx, htmlContent, { 
      status: 200,
      headers: { "Content-Type": "text/html" } 
    });
  }

  /**
   * Handler for search endpoint
   */
  async function handleSearch(ctx: MixonContext): Promise<void> {
    const postsResult = await getPostsWithCache();

    if (!postsResult.ok) {
      handleError(ctx, 500, "Failed to load posts", "Error loading posts");
      return;
    }

    if (!ctx.validated.query.ok) {
      handleError(ctx, 400, "Invalid search query", ctx.validated.query.error);
      return;
    }

    const posts = postsResult.value;
    const url = new URL(ctx.request.url);
    const query = url.searchParams.get("q") || "";
    const results = searchPosts(posts, query);
    const content = renderSearchResults(results, query);

    ctx.response = createResponse(ctx, content, {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
  }

  /**
   * Handler for RSS feed
   */
  async function handleRssFeed(ctx: MixonContext): Promise<void> {
    const postsResult = await getPostsWithCache();

    if (!postsResult.ok) {
      handleError(ctx, 500, "Failed to generate RSS feed", "Error loading posts");
      return;
    }

    const posts = postsResult.value;
    const rssContent = generateRSS(posts, config.blog.title, config.server.publicUrl);

    ctx.response = createResponse(ctx, rssContent, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "max-age=300", // 5 minutes cache
      }
    });
  }

  /**
   * Handler for creating new posts
   */
  async function handleCreatePost(ctx: MixonContext): Promise<void> {
    logger.info("Handling create post request");

    // Validation: Check content type and body validation
    if (!ctx.validated.body.ok) {
      logger.error("Invalid request body");
      handleError(ctx, 400, "Invalid request body", ctx.validated.body.error);
      return;
    }

    // Validate required fields
    const postData = ctx.validated.body.value as Record<string, unknown>;
    const { title, content, tags } = postData;
    logger.info(`Title: ${title}, Content length: ${(content as string)?.length || 0}, Tags: ${JSON.stringify(tags)}`);

    if (!title || !content) {
      logger.info("Missing required fields");
      ctx.response = createResponse(ctx, 
        { error: "Title and content are required" },
        { status: 400 }
      );
      return;
    }

    // Generate slug from title
    const slug = (title as string).toLowerCase()
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

      ctx.response = createResponse(ctx, response, {
        status: 201,
        headers: {
          "Access-Control-Allow-Origin": "*"  // Allow CORS for testing
        }
      });
    } catch (error) {
      logger.error("Failed to create post:", error);
      
      handleError(ctx, 500, "Failed to create post", String(error));
    }
  }

  /**
   * Handler for static files
   */
  async function handleStaticFile(ctx: MixonContext): Promise<void> {
    if (!ctx.validated.params.ok) {
      handleError(ctx, 400, "Invalid static file path", ctx.validated.params.error);
      return;
    }
    
    const url = new URL(ctx.request.url);
    const path = url.pathname;
    const filePath = `${Deno.cwd()}/public${path}`;

    logger.info(`Handling static file: ${filePath}`);

    try {
      // Check cache first
      if (CACHES.static.has(filePath)) {
        const cached = CACHES.static.get(filePath)!;
        ctx.response = createStaticResponse(cached.data, cached.contentType, filePath);
        return;
      }

      // Read file
      const file = await Deno.readFile(filePath);
      const contentType = getContentType(filePath);
      
      // Add debug logging for JS files
      if (filePath.endsWith('.js')) {
        logger.info(`Serving JS file with content type: ${contentType}`);
        
        // Print first few bytes for debugging
        const textDecoder = new TextDecoder();
        const fileStart = textDecoder.decode(file.slice(0, 50));
        logger.info(`JS file start: ${fileStart}`);
      }

      // Cache smaller files (< 1MB)
      if (file.length < 1024 * 1024) {
        CACHES.static.set(filePath, { data: file, contentType });
      }

      const response = createStaticResponse(file, contentType, filePath);
      ctx.response = response;
      
      logger.info(`Served static file: ${filePath} with content type: ${contentType}`);
    } catch (error) {
      logger.error(`Error serving static file ${filePath}:`, error);
      handleError(ctx, 404, "Static file not found", { path, filePath });
    }
  }

  /**
   * Handler for 404 not found
   */
  async function handleNotFound(ctx: MixonContext): Promise<void> {
    // Using await to make this an async function even though we don't need it
    await Promise.resolve();

    const content = renderNotFound();
    const url = new URL(ctx.request.url);
    const path = url.pathname;
    const isHtmxRequest = ctx.request.headers.get("HX-Request") === "true";

    if (isHtmxRequest) {
      const headers = {
        "Content-Type": "text/html",
        "HX-Push-Url": path,
      };
      
      ctx.response = createResponse(ctx, content, { 
        status: 404,
        headers 
      });
      return;
    }

    const htmlContent = renderDocument(
      {
        title: config.blog.title,
        path
      },
      content,
      {
        baseUrl: config.server.publicUrl,
        description: config.blog.description,
      }
    );
    
    ctx.response = createResponse(ctx, htmlContent, { 
      status: 404,
      headers: { "Content-Type": "text/html" } 
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
    const headers: Record<string, string> = { 
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff" // Prevent MIME type sniffing
    };

    // Set caching headers based on file type
    if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
      headers["Cache-Control"] = "no-cache"; // Disable caching for debugging
    } else if (
      filePath.endsWith(".svg") || filePath.endsWith(".png") ||
      filePath.endsWith(".jpg") || filePath.endsWith(".gif")
    ) {
      headers["Cache-Control"] = "public, max-age=1209600"; // 2 weeks
    } else {
      headers["Cache-Control"] = "public, max-age=86400"; // 1 day
    }

    headers["Vary"] = "Accept-Encoding";

    if (filePath.endsWith(".js")) {
      logger.info(`Creating response for JS file: ${filePath} with headers:`, headers);
    }

    return new Response(file, { 
      status: 200,
      headers: new Headers(headers)
    });
  };

  /**
   * Get content type based on file extension
   */
  const getContentType = (filePath: string): string => {
    if (filePath.endsWith(".css")) return "text/css";
    if (filePath.endsWith(".js")) return "application/javascript";
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
   * Get posts with caching
   */
  const getPostsWithCache = async () => {
    const cachedPosts = CACHES.posts.get();

    if (cachedPosts) {
      return { ok: true, value: cachedPosts };
    }

    const postsResult = await loadPosts();

    if (postsResult.ok) {
      CACHES.posts.set(postsResult.value);
    }

    return postsResult;
  };
};
