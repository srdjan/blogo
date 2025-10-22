import type { Post } from "./lib/types.ts";
import { stripHtml } from "./utils.ts";

/**
 * Generate JSON-LD schema for the blog
 */
export const generateWebsiteSchema = (
  title: string,
  url: string,
  description: string,
): string => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": title,
    "url": url,
    "description": description,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return JSON.stringify(schema);
};

/**
 * Generate JSON-LD schema for a blog post
 */
export const generateBlogPostSchema = (
  post: Post,
  baseUrl: string,
): string => {
  const postUrl = `${baseUrl}/posts/${post.slug}`;

  // Extract plain text from HTML content for the description
  const plainTextContent = stripHtml(post.content).substring(0, 200) + "...";

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": postUrl,
    },
    "headline": post.title,
    "description": post.excerpt || plainTextContent,
    "datePublished": new Date(post.date).toISOString(),
    "dateModified": post.modified
      ? new Date(post.modified).toISOString()
      : new Date(post.date).toISOString(),
    "keywords": post.tags?.join(", ") || "",
    "url": postUrl,
  };

  return JSON.stringify(schema);
};

// NOTE: OpenGraph and Twitter Card tags are generated inline in Layout.tsx
// The generateOpenGraphTags() and generateTwitterCardTags() functions were removed
// as they were unused. If needed in the future, they can be recreated or tags
// can continue to be generated inline in the Layout component.
