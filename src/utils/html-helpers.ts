import { formatDate } from "../utils.ts";
import type { Post } from "../types.ts";

/**
 * Common HTMX attributes for navigation links
 */
const HTMX_NAV_ATTRS =
  `hx-target="#content-area" hx-swap="innerHTML" hx-push-url="true"`;

/**
 * Create an HTMX navigation link with minimal classes
 */
export const createHtmxLink = (
  href: string,
  content: string,
  className = "",
  additionalAttrs = "",
): string => {
  const classAttr = className ? ` class="${className}"` : "";
  return `<a href="${href}"${classAttr} hx-get="${href}" ${HTMX_NAV_ATTRS} ${additionalAttrs}>${content}</a>`;
};

/**
 * Create a post detail page link
 */
export const createPostLink = (slug: string, title: string): string => {
  return createHtmxLink(`/posts/${slug}`, title);
};

/**
 * Create a tag link using semantic markup
 */
export const createTagLink = (tag: string): string => {
  return createHtmxLink(`/tags/${tag}`, `# ${tag}`);
};

/**
 * Create a home navigation link
 */
export const createHomeLink = (text = "Return Home"): string => {
  return createHtmxLink("/", text);
};

/**
 * Render tags as semantic list with role attribute
 */
export const renderTags = (tags: string[]): string => {
  if (!tags || tags.length === 0) return "";

  const tagLinks = tags.map((tag) => `<li>${createTagLink(tag)}</li>`).join("");
  return `<ul role="list">${tagLinks}</ul>`;
};

/**
 * Render post metadata using semantic elements
 */
export const renderPostMeta = (post: Post): string => {
  const formattedDate = post.formattedDate || formatDate(post.date);
  const tags = renderTags(post.tags || []);

  return `<small>
    <time datetime="${post.date}">◐ ${formattedDate}</time>
    ${tags ? ` ${tags}` : ''}
  </small>`;
};

/**
 * Wrap content in a semantic section
 */
export const wrapContentSection = (
  content: string,
  ariaLabel?: string,
): string => {
  const labelAttr = ariaLabel ? ` aria-label="${ariaLabel}"` : "";
  return `<section${labelAttr}>${content}</section>`;
};

/**
 * Pluralize a word based on count
 */
export const pluralize = (
  count: number,
  singular: string,
  plural?: string,
): string => {
  if (count === 1) return singular;
  return plural || `${singular}s`;
};

/**
 * Render post excerpt using semantic summary element
 */
export const renderPostExcerpt = (post: Post): string => {
  return post.excerpt ? `<summary>${post.excerpt}</summary>` : "";
};
