import { formatDate } from "../utils.ts";
import type { Post } from "../types.ts";

/**
 * Common HTMX attributes for navigation links
 */
const HTMX_NAV_ATTRS = `hx-target="#content-area" hx-swap="innerHTML" hx-push-url="true"`;

/**
 * Create an HTMX navigation link
 */
export const createHtmxLink = (
  href: string,
  content: string,
  className = "link",
  additionalAttrs = ""
): string => {
  return `<a href="${href}" class="${className}" hx-get="${href}" ${HTMX_NAV_ATTRS} ${additionalAttrs}>${content}</a>`;
};

/**
 * Create a post detail page link
 */
export const createPostLink = (slug: string, title: string): string => {
  return createHtmxLink(`/posts/${slug}`, title);
};

/**
 * Create a tag link
 */
export const createTagLink = (tag: string): string => {
  return createHtmxLink(`/tags/${tag}`, tag, "tag link");
};

/**
 * Create a home navigation link
 */
export const createHomeLink = (text = "Return Home"): string => {
  return createHtmxLink("/", text, "button link");
};

/**
 * Render tags as HTML links
 */
export const renderTags = (tags: string[]): string => {
  if (!tags || tags.length === 0) return "";
  
  const tagLinks = tags.map(tag => createTagLink(tag)).join("");
  return `<div class="tags">${tagLinks}</div>`;
};

/**
 * Render post metadata (date and tags)
 */
export const renderPostMeta = (post: Post): string => {
  const formattedDate = post.formattedDate || formatDate(post.date);
  const tags = renderTags(post.tags || []);
  
  return `<div class="post-meta">
    <time datetime="${post.date}">${formattedDate}</time>
    ${tags}
  </div>`;
};

/**
 * Wrap content in a content section
 */
export const wrapContentSection = (content: string, className: string): string => {
  return `<section class="${className} content-section">${content}</section>`;
};

/**
 * Pluralize a word based on count
 */
export const pluralize = (count: number, singular: string, plural?: string): string => {
  if (count === 1) return singular;
  return plural || `${singular}s`;
};

/**
 * Render post excerpt if available
 */
export const renderPostExcerpt = (post: Post): string => {
  return post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : "";
};