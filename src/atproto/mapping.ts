// Bidirectional mapping between Post and StandardDocument
import type { Post, Slug } from "../lib/types.ts";
import type { DocumentContent, StandardDocument } from "./types.ts";

// --- Slug <-> rkey conversion ---

export const slugToRkey = (slug: Slug): string =>
  (slug as string).replace(/[^a-zA-Z0-9-]/g, "");

// --- Publish direction: Post -> StandardDocument ---

export type PostToDocumentParams = {
  readonly post: Post;
  readonly rawMarkdown: string;
  readonly publicationUri: string;
  readonly publicUrl: string;
};

export const postToDocument = (
  params: PostToDocumentParams,
): StandardDocument => {
  const { post, rawMarkdown, publicationUri, publicUrl } = params;

  const content: DocumentContent = {
    $type: "site.standard.content.markdown",
    value: rawMarkdown,
  };

  // Strip markdown syntax for textContent (basic approach)
  const textContent = stripMarkdown(rawMarkdown);

  return {
    $type: "site.standard.document",
    site: publicationUri,
    title: post.title,
    publishedAt: new Date(post.date).toISOString(),
    path: `/posts/${post.slug as string}`,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    content,
    textContent: textContent.slice(0, 10000), // limit textContent
    ...(post.tags && post.tags.length > 0
      ? { tags: post.tags.map((t) => t as string) }
      : {}),
    ...(post.modified
      ? { updatedAt: new Date(post.modified).toISOString() }
      : {}),
  };
};

// --- Pull direction: StandardDocument -> markdown file ---

export type DocumentToMarkdownResult = {
  readonly filename: string;
  readonly content: string;
};

export const documentToMarkdown = (
  doc: StandardDocument,
): DocumentToMarkdownResult => {
  const slug = doc.path.replace(/^\/posts\//, "").replace(/\/$/, "");
  const filename = `${slug}.md`;

  // Extract body from content
  const body = extractBody(doc.content);

  // Build frontmatter
  const frontmatterLines: string[] = [
    "---",
    `title: "${escapeFrontmatterString(doc.title)}"`,
    `date: ${doc.publishedAt.split("T")[0]}`,
  ];

  if (doc.tags && doc.tags.length > 0) {
    frontmatterLines.push("tags:");
    for (const tag of doc.tags) {
      frontmatterLines.push(`  - ${tag}`);
    }
  }

  if (doc.description) {
    frontmatterLines.push(
      `excerpt: "${escapeFrontmatterString(doc.description)}"`,
    );
  }

  if (doc.updatedAt) {
    frontmatterLines.push(`modified: ${doc.updatedAt.split("T")[0]}`);
  }

  frontmatterLines.push("---");

  return {
    filename,
    content: frontmatterLines.join("\n") + "\n" + body,
  };
};

// --- Helpers ---

const extractBody = (content: DocumentContent | undefined): string => {
  if (!content) return "";

  switch (content.$type) {
    case "site.standard.content.markdown":
      return content.value ?? "";
    case "site.standard.content.html":
      return content.value ?? "";
    default:
      return (content as { value?: string }).value ?? "";
  }
};

const stripMarkdown = (md: string): string =>
  md
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
    .replace(/>\s+/gm, "") // blockquotes
    .replace(/[-*+]\s+/gm, "") // list items
    .replace(/\n{2,}/g, "\n") // collapse newlines
    .trim();

const escapeFrontmatterString = (s: string): string => s.replace(/"/g, '\\"');
