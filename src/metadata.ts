import type { Post } from "./lib/types.ts";
import { escapeHtml, stripHtml } from "./utils.ts";

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

/**
 * Generate OpenGraph metadata tags for the blog
 */
export const generateOpenGraphTags = (
  title: string,
  url: string,
  description: string,
  type: "website" | "article" = "website",
  imageUrl?: string,
): string => {
  return `
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${url}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ""}
  `;
};

/**
 * Generate Twitter Card metadata tags
 */
export const generateTwitterCardTags = (
  title: string,
  description: string,
  cardType: "summary" | "summary_large_image" = "summary",
  imageUrl?: string,
): string => {
  return `
  <meta name="twitter:card" content="${cardType}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ""}
  `;
};

// Using escapeHtml from utils.ts
