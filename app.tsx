import { createLayout } from "./src/components/Layout.tsx";
import { PostView } from "./src/components/PostView.tsx";
import { SearchResults } from "./src/components/SearchResults.tsx";
import { PostList } from "./src/components/PostList.tsx";
import { About } from "./src/components/About.tsx";
import { TagIndex } from "./src/components/TagIndex.tsx";
import {
  getCachedPosts,
  getCachedTags,
  getPostBySlug,
  getPostsByTag,
  searchPostsByQuery,
} from "./src/utils/content-loader.ts";
import { generateRSS } from "./src/rss.ts";
import { generateSitemap, generateRobotsTxt } from "./src/sitemap.ts";
import { generateOGImage, generateDefaultOGImage } from "./src/og-image.ts";

const app = {
  async fetch(req: Request) {
    const url = new URL(req.url);

    console.log(`${req.method} ${url.pathname}`);

    // Handle static files
    if (
      url.pathname.startsWith("/css/") || url.pathname.startsWith("/js/") ||
      url.pathname.startsWith("/images/") ||
      url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico" ||
      url.pathname === "/manifest.json" ||
      url.pathname.endsWith(".jpg") || url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".wav") || url.pathname.endsWith(".mp3") ||
      url.pathname.endsWith(".ogg") || url.pathname.endsWith(".flac") ||
      url.pathname.endsWith(".m4a") || url.pathname.endsWith(".aac")
    ) {
      try {
        // Files are in public/ directory, so map /css/main.css to public/css/main.css
        const filePath = `public${url.pathname}`;
        console.log(`Trying to serve static file: ${filePath}`);

        const file = await Deno.readFile(filePath);
        const ext = filePath.split(".").pop();

        let contentType = "text/plain";
        if (ext === "css") contentType = "text/css";
        else if (ext === "js") contentType = "application/javascript";
        else if (ext === "html") contentType = "text/html";
        else if (ext === "svg") contentType = "image/svg+xml";
        else if (ext === "ico") contentType = "image/x-icon";
        else if (ext === "json") contentType = "application/json";
        else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "wav") contentType = "audio/wav";
        else if (ext === "mp3") contentType = "audio/mpeg";
        else if (ext === "ogg") contentType = "audio/ogg";
        else if (ext === "flac") contentType = "audio/flac";
        else if (ext === "m4a") contentType = "audio/mp4";
        else if (ext === "aac") contentType = "audio/aac";

        return new Response(file, {
          headers: { "Content-Type": contentType },
        });
      } catch (error) {
        console.log(
          `Static file not found: ${url.pathname}, error:`,
          error instanceof Error ? error.message : String(error),
        );
        return new Response("File not found", { status: 404 });
      }
    }

    // Handle root route with real blog posts
    if (url.pathname === "/") {
      const posts = await getCachedPosts();

      return createLayout({
        title: "Blog - Home",
        description: "A minimal blog built with mono-jsx",
        path: url.pathname,
        children: <PostList posts={posts} />,
        author: "Srdjan Strbanovic"
      });
    }

    // Handle tags route with real tags
    if (url.pathname === "/tags") {
      const tags = await getCachedTags();

      return createLayout({
        title: "Tags - Blog",
        description: "Browse posts by tags",
        path: url.pathname,
        children: <TagIndex tags={tags} />,
        author: "Srdjan Strbanovic"
      });
    }

    // Handle about route with blog layout
    if (url.pathname === "/about") {
      return createLayout({
        title: "About - Blog",
        description: "About this blog and its features",
        path: url.pathname,
        children: <About />,
      });
    }

    // Handle individual post routes: /posts/slug
    if (url.pathname.startsWith("/posts/")) {
      const slug = url.pathname.replace("/posts/", "");
      const post = await getPostBySlug(slug);

      if (!post) {
        return new Response("Post not found", { status: 404 });
      }

      return createLayout({
        title: `${post.title} - Blog`,
        description: post.excerpt || `Read ${post.title}`,
        path: url.pathname,
        children: <PostView post={post} />,
        type: 'article',
        publishedTime: post.date,
        modifiedTime: post.modified,
        tags: post.tags,
        author: "Srdjan Strbanovic"
      });
    }

    // Handle tag routes: /tags/tagname
    if (url.pathname.startsWith("/tags/") && url.pathname !== "/tags") {
      const tagName = decodeURIComponent(url.pathname.replace("/tags/", ""));
      const posts = await getPostsByTag(tagName);

      return createLayout({
        title: `Posts tagged "${tagName}" - Blog`,
        description: `All posts tagged with ${tagName}`,
        path: url.pathname,
        children: <PostList posts={posts} activeTag={tagName} />,
        author: "Srdjan Strbanovic"
      });
    }

    // Handle search requests: /search?q=query
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q");

      if (!query) {
        return createLayout({
          title: "Search - Blog",
          description: "Search blog posts",
          path: url.pathname,
          children: (
            <main>
              <h1>Search</h1>
              <p>Please provide a search query.</p>
              <a href="/">← Back to home</a>
            </main>
          ),
          author: "Srdjan Strbanovic"
        });
      }

      const posts = await searchPostsByQuery(query);

      return createLayout({
        title: `Search: "${query}" - Blog`,
        description: `Search results for ${query}`,
        path: url.pathname,
        children: <SearchResults posts={posts} query={query} />,
      });
    }

    // Handle minimal search for modal: /search-modal?q=query
    if (url.pathname === "/search-modal") {
      const query = url.searchParams.get("q");

      if (!query) {
        return new Response("Missing query parameter", { status: 400 });
      }

      const posts = await searchPostsByQuery(query);

      // Return just HTML fragment as string for the modal
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
    }

    // Handle RSS feed
    if (url.pathname === "/feed.xml") {
      const posts = await getCachedPosts();
      const baseUrl = url.origin;
      const rssContent = generateRSS(
        posts,
        "Blog",
        baseUrl,
        "A minimal blog built with mono-jsx",
      );

      return new Response(rssContent, {
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "max-age=3600", // Cache for 1 hour
        },
      });
    }

    // Handle XML Sitemap
    if (url.pathname === "/sitemap.xml") {
      const posts = await getCachedPosts();
      const baseUrl = url.origin;
      const sitemapContent = generateSitemap(posts, baseUrl);

      return new Response(sitemapContent, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "max-age=3600", // Cache for 1 hour
        },
      });
    }

    // Handle robots.txt
    if (url.pathname === "/robots.txt") {
      const baseUrl = url.origin;
      const robotsContent = generateRobotsTxt(baseUrl);

      return new Response(robotsContent, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "max-age=86400", // Cache for 24 hours
        },
      });
    }

    // Handle default OG image
    if (url.pathname === "/images/og-default.png") {
      const svgContent = generateDefaultOGImage();
      
      return new Response(svgContent, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "max-age=3600", // Cache for 1 hour
        },
      });
    }

    // Handle dynamic OG images for posts: /images/og/post-slug.png
    if (url.pathname.startsWith("/images/og/") && url.pathname.endsWith(".png")) {
      const slug = url.pathname.replace("/images/og/", "").replace(".png", "");
      const post = await getPostBySlug(slug);
      
      if (!post) {
        // Return default image if post not found
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
          "Cache-Control": "max-age=3600", // Cache for 1 hour
        },
      });
    }

    // For all other routes, return 404 with more info
    return new Response(`Route not found in mono-jsx app: ${url.pathname}`, {
      status: 404,
    });
  },
};

// Serve wrapper function
interface ServeOptions {
  port?: number;
  hostname?: string;
  signal?: AbortSignal;
}

export const serve = (
  fetchHandler: (request: Request) => Response | Promise<Response>,
  options: ServeOptions = {},
): Deno.HttpServer => {
  const { port = 8000, hostname = "localhost", signal } = options;

  return Deno.serve(
    { port, hostname, signal },
    fetchHandler,
  );
};

// Start the server
if (import.meta.main) {
  console.log("Starting server on http://localhost:8000");
  serve(app.fetch);
}
