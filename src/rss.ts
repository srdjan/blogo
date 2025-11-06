import type { Post } from "./lib/types.ts";
import { escapeXml } from "./utils.ts";

/**
 * Generate a single RSS item from a post
 */
const generateRssItem = (post: Post, baseUrl: string): string => {
  const postUrl = `${baseUrl}/posts/${post.slug}`;
  const pubDate = new Date(post.date).toUTCString();
  const description = post.excerpt ||
    post.content.replace(/<[^>]*>/g, "").substring(0, 200) + "...";

  const categories = post.tags && post.tags.length > 0
    ? post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join(
      "\n      ",
    )
    : "";

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid>${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
      ${categories}
    </item>`;
};

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

  const items = recentPosts
    .map((post) => generateRssItem(post, baseUrl))
    .join("\n");

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

/**
 * Generate a topic-specific RSS feed
 */
export function generateTopicRssFeed(
  posts: Post[],
  topicTitle: string,
  baseUrl: string,
  selfPath: string, // e.g. /rss/topic/web-development
  description?: string,
): string {
  const now = new Date().toUTCString();
  const feedDescription = description || `${topicTitle} - Latest posts`;

  const recentPosts = posts.slice(0, 20);

  const items = recentPosts
    .map((post) => generateRssItem(post, baseUrl))
    .join("\n");

  const selfUrl = `${baseUrl}${selfPath}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(topicTitle)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${
    escapeXml(selfUrl)
  }" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
