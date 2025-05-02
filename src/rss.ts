// src/rss.ts - RSS feed generation
import { Post } from "./types.ts";

/**
 * Generate RSS XML for a list of posts
 */
export const generateRSS = (
  posts: Post[],
  blogTitle: string,
  blogURL: string,
): string => {
  const items = posts.map((post) => {
    const postURL = `${blogURL}/posts/${post.slug}`;
    return `
    <item>
      <title>${escapeXML(post.title)}</title>
      <link>${postURL}</link>
      <guid>${postURL}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      ${
      post.excerpt
        ? `<description>${escapeXML(post.excerpt)}</description>`
        : ""
    }
      <content:encoded><![CDATA[${post.content}]]></content:encoded>
    </item>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(blogTitle)}</title>
    <link>${blogURL}</link>
    <description>Articles from ${escapeXML(blogTitle)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${blogURL}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
};

/**
 * Helper function to escape XML special characters
 */
const escapeXML = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};
