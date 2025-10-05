// Individual post view component for mono-jsx
import type { Post } from "../lib/types.ts";
import { html } from "mono-jsx/jsx-runtime";
import { deriveTopicsFromTags } from "../config/topics.ts";

export const PostView = (props: { readonly post: Post }) => {
  const { post } = props;

  return (
    <>
      <article class="post-content">
          <h2>{post.title}</h2>
          {post.formattedDate && <time>{post.formattedDate}</time>}
          {/* Derived topics shown above tags for hierarchy */}
          {post.tags && post.tags.length > 0 && (() => {
            const topics = deriveTopicsFromTags(post.tags as readonly string[]);
            return topics.length > 0
              ? (
                <div
                  class="topics"
                  style="margin-top: var(--size-2); color: var(--color-text-muted);"
                >
                  <small>Topics: {topics.join(", ")}</small>
                </div>
              )
              : null;
          })()}

          {post.tags && post.tags.length > 0 && (
            <nav class="tags" aria-label="Post tags">
              {post.tags.map((tag, index) => (
                <>
                  <a
                    href={`/tags/${encodeURIComponent(tag)}`}
                    hx-get={`/tags/${encodeURIComponent(tag)}`}
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                    class="tag"
                  >
                    {tag}
                  </a>
                  {index < (post.tags?.length ?? 0) - 1 && " "}
                </>
              ))}
            </nav>
          )}
        <div class="content">
          {html(post.content)}
        </div>
      </article>
      <nav style="text-align: center; margin-top: var(--space-xl);">
        <a href="/">← Back to home</a>
      </nav>
    </>
  );
};
