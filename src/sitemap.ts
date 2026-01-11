// XML Sitemap generation for SEO
import type { Post } from "./lib/types.ts";

export function generateSitemap(posts: Post[], baseUrl: string): string {
  const postPages = posts.map((post) => ({
    url: `/posts/${post.slug}`,
    lastmod: post.modified || post.date,
    priority: "0.9",
  }));

  // Only include post URLs in sitemap.xml.
  const allPages = postPages;

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${
    allPages.map((page) =>
      `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date(page.lastmod).toISOString()}</lastmod>
    <changefreq>${getChangeFreq(page.url)}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    ).join("\n")
  }
</urlset>`;

  return sitemapContent;
}

function getChangeFreq(url: string): string {
  if (url.startsWith("/posts/")) return "monthly";
  return "monthly";
}

export function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Host: ${baseUrl}

# Common crawl delays
Crawl-delay: 1

# Block development/test paths
Disallow: /dev/
Disallow: /test/
Disallow: /_/
`;
}
