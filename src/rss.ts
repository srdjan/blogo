import { Post } from "./types.ts";
import { escapeXml } from "./utils.ts";

/**
 * Generate RSS XML for a list of posts
 */
export const generateRSS = (
  posts: Post[],
  blogTitle: string,
  blogURL: string,
): string => {
  const items = posts.slice(0, 20).map((post) => { // Limit to 20 most recent posts
    const postURL = `${blogURL}/posts/${post.slug}`;
    const pubDate = new Date(post.date).toUTCString();

    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postURL}</link>
      <guid isPermaLink="true">${postURL}</guid>
      <pubDate>${pubDate}</pubDate>
      ${
      post.excerpt
        ? `<description>${escapeXml(post.excerpt)}</description>`
        : ""
    }
      ${
      post.tags && post.tags.length > 0
        ? post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join(
          "\n      ",
        )
        : ""
    }
      <content:encoded><![CDATA[${post.content}]]></content:encoded>
    </item>`;
  }).join("\n");

  const mostRecentPost = posts[0];
  const lastBuildDate = mostRecentPost
    ? new Date(mostRecentPost.date).toUTCString()
    : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(blogTitle)}</title>
    <link>${blogURL}</link>
    <description>Articles from ${escapeXml(blogTitle)}</description>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(blogTitle)}</copyright>
    <managingEditor>noreply@example.com (${
    escapeXml(blogTitle)
  })</managingEditor>
    <webMaster>noreply@example.com (${escapeXml(blogTitle)})</webMaster>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${lastBuildDate}</pubDate>
    <ttl>60</ttl>
    <generator>Deno Blog with Mixon</generator>
    <atom:link href="${blogURL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
};

// Using escapeXml from utils.ts
