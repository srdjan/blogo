import { Post } from "./types.ts";
import { escapeXml } from "./utils.ts";

/**
 * Generate RSS feed XML from posts
 */
export function generateRSS(
  posts: Post[],
  title: string,
  baseUrl: string,
  description?: string,
): string {
  const now = new Date().toUTCString();
  const feedDescription = description || `${title} - Latest posts`;

  // Take only the latest 20 posts for RSS
  const recentPosts = posts.slice(0, 20);

  const items = recentPosts.map((post) => {
    const postUrl = `${baseUrl}/posts/${post.slug}`;
    const pubDate = new Date(post.date).toUTCString();

    // Create a plain text description from content or use excerpt
    const description = post.excerpt ||
      post.content.replace(/<[^>]*>/g, "").substring(0, 200) + "...";

    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid>${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
      ${
      post.tags && post.tags.length > 0
        ? post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join(
          "\n      ",
        )
        : ""
    }
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${
    escapeXml(baseUrl)
  }/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
