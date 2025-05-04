import { Post, RenderContext, TagInfo } from "./types.ts";
import type { Pagination } from "./pagination.ts";
import {
  generateBlogPostSchema,
  generateOpenGraphTags,
  generateTwitterCardTags,
  generateWebsiteSchema,
} from "./metadata.ts";
import { Document } from "./components/Document.tsx";
import { PostContent } from "./components/Post.tsx";
import { renderPostListHtml } from "./components/PostListHtml.tsx";
import { renderAboutHtml } from "./components/AboutHtml.tsx";
import { renderNotFoundHtml } from "./components/NotFoundHtml.tsx";
import { renderTagIndexHtml } from "./components/TagIndexHtml.tsx";
import { renderSearchResultsHtml } from "./components/SearchResultsHtml.tsx";
import { renderErrorPageHtml } from "./components/ErrorPageHtml.tsx";

// These helper functions are no longer needed as they've been replaced by JSX components

/**
 * Render the HTML document shell
 * Uses JSX for declarative UI composition
 */
export const renderDocument = (
  context: RenderContext,
  content: string,
  config: {
    baseUrl: string;
    description: string;
  },
): string => {
  // Determine title based on context
  const pageTitle = context.post
    ? `${context.post.title} - ${context.title}`
    : context.title;

  // Determine description based on context
  const pageDescription = context.post
    ? (context.post.excerpt || config.description)
    : config.description;

  // Generate structured data
  const structuredData = context.post
    ? generateBlogPostSchema(context.post, config.baseUrl)
    : generateWebsiteSchema(context.title, config.baseUrl, config.description);

  // Generate OpenGraph and Twitter Card tags
  const ogTags = generateOpenGraphTags(
    pageTitle,
    `${config.baseUrl}${context.path}`,
    pageDescription,
    context.post ? "article" : "website",
  );

  const twitterTags = generateTwitterCardTags(
    pageTitle,
    pageDescription,
  );

  // Use our Document component to render the full HTML document
  const element = Document({
    title: pageTitle,
    description: pageDescription,
    path: context.path,
    content,
    structuredData,
    ogTags,
    twitterTags,
  });
  return String(element);
};

export const renderPost = (post: Post): string => {
  // Use our PostContent component to render the post
  const element = PostContent({ post });
  return String(element);
};

export const renderNotFound = (): string => {
  // Use the renderNotFoundHtml function from components/NotFoundHtml.tsx
  return renderNotFoundHtml();
};

export const renderAbout = (): string => {
  // Use the renderAboutHtml function from components/AboutHtml.tsx
  return renderAboutHtml();
};

export const renderTagIndex = (tags: TagInfo[]): string => {
  // Use the renderTagIndexHtml function from components/TagIndexHtml.tsx
  return renderTagIndexHtml(tags);
};

export const renderPostList = (
  posts: Post[],
  activeTag?: string,
  pagination?: Pagination,
): string => {
  // Use the renderPostListHtml function from components/PostListHtml.tsx
  return renderPostListHtml(posts, activeTag, pagination);
};

export const renderSearchResults = (posts: Post[], query: string): string => {
  // Use the renderSearchResultsHtml function from components/SearchResultsHtml.tsx
  return renderSearchResultsHtml(posts, query);
};

export const renderErrorPage = (error: {
  title: string;
  message: string;
  stackTrace?: string;
}): string => {
  // Use the renderErrorPageHtml function from components/ErrorPageHtml.tsx
  return renderErrorPageHtml(error);
};
