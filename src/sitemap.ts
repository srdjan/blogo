// XML Sitemap generation for SEO
import { Post } from "./types.ts";

export function generateSitemap(posts: Post[], baseUrl: string): string {
  const staticPages = [
    { url: '/', lastmod: new Date().toISOString(), priority: '1.0' },
    { url: '/about', lastmod: new Date().toISOString(), priority: '0.8' },
    { url: '/tags', lastmod: new Date().toISOString(), priority: '0.7' }
  ];

  const postPages = posts.map(post => ({
    url: `/posts/${post.slug}`,
    lastmod: post.modified || post.date,
    priority: '0.9'
  }));

  // Get unique tags for tag pages
  const allTags = [...new Set(posts.flatMap(post => post.tags || []))];
  const tagPages = allTags.map(tag => ({
    url: `/tags/${encodeURIComponent(tag)}`,
    lastmod: new Date().toISOString(),
    priority: '0.6'
  }));

  const allPages = [...staticPages, ...postPages, ...tagPages];

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date(page.lastmod).toISOString()}</lastmod>
    <changefreq>${getChangeFreq(page.url)}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return sitemapContent;
}

function getChangeFreq(url: string): string {
  if (url === '/') return 'daily';
  if (url.startsWith('/posts/')) return 'monthly';
  if (url.startsWith('/tags/')) return 'weekly';
  return 'monthly';
}

export function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# Common crawl delays
Crawl-delay: 1

# Block development/test paths
Disallow: /dev/
Disallow: /test/
Disallow: /_/
`;
}